import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { IdTokenVerifier } from '../src/auth';
import { AppError } from '../src/common';
import { bearer, boot, resetDb, signIn } from './helpers';

/** Stands in for Google: "good:<sub>:<email>" verifies, anything else is rejected. */
const fakeGoogle: IdTokenVerifier = {
  name: 'fake-google',
  accepts: () => true,
  verify: async (idToken) => {
    const [kind, sub, email] = idToken.split(':');
    if (kind !== 'good' || !sub || !email) throw new AppError('AUTH_INVALID_GOOGLE_TOKEN', 'bad token', 401);
    return { sub, email, name: 'Asha' };
  },
};

describe('auth', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/auth/google', () => {
    beforeEach(async () => {
      app = await boot({ verifiers: [fakeGoogle] });
      await resetDb(app);
    });

    it('creates the user on first sign-in and returns tokens', async () => {
      const res = await http().post('/v1/auth/google').send({ idToken: 'good:sub-1:asha@example.com', deviceId: 'device-0001' }).expect(200);
      expect(res.body).toMatchObject({ expiresIn: 900, user: { email: 'asha@example.com', onboarded: false, monthlyIncomePaise: null } });
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.refreshToken).toHaveLength(43);
    });

    it('keys the user by Google sub, not email', async () => {
      const first = await http().post('/v1/auth/google').send({ idToken: 'good:sub-1:old@example.com', deviceId: 'device-0001' });
      const second = await http().post('/v1/auth/google').send({ idToken: 'good:sub-1:new@example.com', deviceId: 'device-0002' });
      expect(second.body.user.id).toBe(first.body.user.id);
      expect(second.body.user.email).toBe('new@example.com');
    });

    it('rejects a token Google does not verify', async () => {
      const res = await http().post('/v1/auth/google').send({ idToken: 'forged', deviceId: 'device-0001' }).expect(401);
      expect(res.body.error.code).toBe('AUTH_INVALID_GOOGLE_TOKEN');
    });

    it('validates the body', async () => {
      const res = await http().post('/v1/auth/google').send({ idToken: 'good:a:b@c.de' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('allows 10 requests a minute, then answers 429', async () => {
      for (let i = 0; i < 10; i++) await http().post('/v1/auth/google').send({ idToken: 'forged', deviceId: 'device-0001' }).expect(401);
      const res = await http().post('/v1/auth/google').send({ idToken: 'forged', deviceId: 'device-0001' }).expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('dev sign-in', () => {
    beforeEach(async () => {
      app = await boot();
      await resetDb(app);
    });

    it('accepts dev:<email> when DEV_AUTH_ENABLED is on', async () => {
      const session = await signIn(app, 'Dev@Altus.local');
      expect(session.user.email).toBe('dev@altus.local');
    });

    it('rejects a malformed dev token', async () => {
      await http().post('/v1/auth/google').send({ idToken: 'dev:not-an-email', deviceId: 'device-0001' }).expect(401);
    });
  });

  describe('refresh and logout', () => {
    beforeEach(async () => {
      app = await boot();
      await resetDb(app);
    });

    it('rotates: the new token works once, the old one is dead', async () => {
      const s = await signIn(app, 'asha@example.com');
      const r1 = await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken, deviceId: 'device-0001' }).expect(200);
      expect(r1.body.refreshToken).not.toBe(s.refreshToken);
      await http().get('/v1/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);
      await http().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken, deviceId: 'device-0001' }).expect(200);
    });

    it('reusing a rotated token revokes every session of that user', async () => {
      const phone = await signIn(app, 'asha@example.com', 'device-phone');
      const tablet = await signIn(app, 'asha@example.com', 'device-tablet');
      await http().post('/v1/auth/refresh').send({ refreshToken: phone.refreshToken, deviceId: 'device-phone' }).expect(200);

      const reuse = await http().post('/v1/auth/refresh').send({ refreshToken: phone.refreshToken, deviceId: 'device-phone' }).expect(401);
      expect(reuse.body.error.code).toBe('AUTH_REFRESH_REUSED');
      const tabletAfter = await http().post('/v1/auth/refresh').send({ refreshToken: tablet.refreshToken, deviceId: 'device-tablet' }).expect(401);
      expect(tabletAfter.body.error.code).toBe('AUTH_REFRESH_REUSED');
    });

    it('rejects an unknown token or another device', async () => {
      const s = await signIn(app, 'asha@example.com');
      const unknown = await http().post('/v1/auth/refresh').send({ refreshToken: 'x'.repeat(43), deviceId: 'device-0001' }).expect(401);
      expect(unknown.body.error.code).toBe('AUTH_REFRESH_INVALID');
      await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken, deviceId: 'device-other' }).expect(401);
    });

    it('logout revokes the device token', async () => {
      const s = await signIn(app, 'asha@example.com');
      await http().post('/v1/auth/logout').set(bearer(s)).send({ refreshToken: s.refreshToken }).expect(204);
      await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken, deviceId: 'device-0001' }).expect(401);
    });

    it("logout cannot revoke another user's token", async () => {
      const asha = await signIn(app, 'asha@example.com');
      const ravi = await signIn(app, 'ravi@example.com', 'device-0002');
      await http().post('/v1/auth/logout').set(bearer(ravi)).send({ refreshToken: asha.refreshToken }).expect(204);
      await http().post('/v1/auth/refresh').send({ refreshToken: asha.refreshToken, deviceId: 'device-0001' }).expect(200);
    });
  });

  describe('JwtAuthGuard', () => {
    beforeEach(async () => {
      app = await boot();
    });

    it('rejects a missing or bad access token', async () => {
      const missing = await http().get('/v1/me').expect(401);
      expect(missing.body.error.code).toBe('AUTH_UNAUTHENTICATED');
      await http().get('/v1/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
    });

    it('leaves health public', async () => {
      await http().get('/v1/health').expect(200);
    });
  });
});
