import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

describe('me and accounts', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/me/onboarding', () => {
    it('saves income in paise and finishes onboarding once', async () => {
      const res = await http()
        .post('/v1/me/onboarding')
        .set(bearer(asha))
        .send({ monthlyIncomePaise: 8_500_000, incomeFrequency: 'monthly' })
        .expect(200);
      expect(res.body).toMatchObject({ onboarded: true, monthlyIncomePaise: 8_500_000, incomeFrequency: 'monthly' });
      const again = await http().post('/v1/me/onboarding').set(bearer(asha)).send({}).expect(409);
      expect(again.body.error.code).toBe('ALREADY_ONBOARDED');
      const me = await http().get('/v1/me').set(bearer(asha)).expect(200);
      expect(me.body.onboarded).toBe(true);
    });

    it('lets the income step be skipped', async () => {
      const res = await http().post('/v1/me/onboarding').set(bearer(asha)).send({}).expect(200);
      expect(res.body).toMatchObject({ onboarded: true, monthlyIncomePaise: null, incomeFrequency: null });
    });

    it.each([[-1], [12.5], ['850000']])('rejects income %p', async (value) => {
      const res = await http().post('/v1/me/onboarding').set(bearer(asha)).send({ monthlyIncomePaise: value }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects an unknown frequency', async () => {
      await http().post('/v1/me/onboarding').set(bearer(asha)).send({ incomeFrequency: 'daily' }).expect(400);
    });

    it("does not touch another user's onboarding", async () => {
      await http().post('/v1/me/onboarding').set(bearer(asha)).send({}).expect(200);
      const me = await http().get('/v1/me').set(bearer(ravi)).expect(200);
      expect(me.body.onboarded).toBe(false);
    });
  });

  describe('/v1/accounts', () => {
    it('creates and lists accounts', async () => {
      const created = await http()
        .post('/v1/accounts')
        .set(bearer(asha))
        .send({ bankName: '  HDFC Bank ', kind: 'savings', maskedNumber: '4821' })
        .expect(201);
      expect(created.body).toMatchObject({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '4821', nickname: null });
      const list = await http().get('/v1/accounts').set(bearer(asha)).expect(200);
      expect(list.body.items).toHaveLength(1);
    });

    it('rejects the same bank and last 4 twice', async () => {
      const body = { bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '4821' };
      await http().post('/v1/accounts').set(bearer(asha)).send(body).expect(201);
      const dup = await http().post('/v1/accounts').set(bearer(asha)).send(body).expect(409);
      expect(dup.body.error.code).toBe('ACCOUNT_EXISTS');
    });

    it.each([['4111111111111111'], ['48a1'], ['482']])('never stores a full or malformed number %p', async (maskedNumber) => {
      await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'credit_card', maskedNumber }).expect(400);
    });

    it('rejects an unknown kind and a user id in the body', async () => {
      await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'X', kind: 'loan' }).expect(400);
      await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'X', kind: 'cash', userId: ravi.user.id }).expect(400);
    });

    it("never shows another user's accounts", async () => {
      await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings' }).expect(201);
      const list = await http().get('/v1/accounts').set(bearer(ravi)).expect(200);
      expect(list.body.items).toEqual([]);
    });

    it('needs a token', async () => {
      await http().get('/v1/accounts').expect(401);
    });
  });
});
