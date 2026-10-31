import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { SYSTEM_CATEGORIES } from '@et/domain';
import { PrismaService } from '../src/common';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

const FOOD = SYSTEM_CATEGORIES[0]!.id;

describe('me: profile, export, delete (F8)', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());

  const addTxn = (s: Session, body: Record<string, unknown> = {}) =>
    http()
      .post('/v1/transactions')
      .set(bearer(s))
      .send({ clientRequestId: randomUUID(), amountPaise: 48_600, direction: 'debit', occurredAt: '2026-10-31T07:42:00Z', ...body });

  const addAccount = (s: Session, body: Record<string, unknown> = {}) =>
    http().post('/v1/accounts').set(bearer(s)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '4821', ...body });

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /v1/me', () => {
    it('updates name, income (paise) and frequency', async () => {
      const res = await http()
        .patch('/v1/me')
        .set(bearer(asha))
        .send({ name: 'Asha K', monthlyIncomePaise: 9_000_000, incomeFrequency: 'monthly' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Asha K', monthlyIncomePaise: 9_000_000, incomeFrequency: 'monthly' });
    });

    it('treats an empty body as a no-op and returns the current profile', async () => {
      await http().patch('/v1/me').set(bearer(asha)).send({ name: 'Asha K' }).expect(200);
      const res = await http().patch('/v1/me').set(bearer(asha)).send({}).expect(200);
      expect(res.body.name).toBe('Asha K');
    });

    it.each([[-1], [12.5], ['9000000']])('rejects monthlyIncomePaise %p', async (value) => {
      const res = await http().patch('/v1/me').set(bearer(asha)).send({ monthlyIncomePaise: value }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects an unknown frequency and an over-long name', async () => {
      await http().patch('/v1/me').set(bearer(asha)).send({ incomeFrequency: 'daily' }).expect(400);
      await http().patch('/v1/me').set(bearer(asha)).send({ name: 'x'.repeat(81) }).expect(400);
    });

    it("never edits another user's profile", async () => {
      await http().patch('/v1/me').set(bearer(asha)).send({ name: 'Asha K' }).expect(200);
      const me = await http().get('/v1/me').set(bearer(ravi)).expect(200);
      expect(me.body.name).not.toBe('Asha K');
    });

    it('needs a token', async () => {
      await http().patch('/v1/me').send({ name: 'x' }).expect(401);
    });
  });

  describe('GET /v1/me/export', () => {
    it('streams a CSV with a header and one line per transaction', async () => {
      const account = await addAccount(asha).expect(201);
      await addTxn(asha, { accountId: account.body.id, categoryId: FOOD, merchantName: 'Swiggy', amountPaise: 123_456 }).expect(201);

      const res = await http().get('/v1/me/export').set(bearer(asha)).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="expense-tracker-export-\d{4}-\d{2}-\d{2}\.csv"/);

      const lines = res.text.trim().split('\r\n');
      expect(lines[0]).toBe('date,amount,direction,type,category,merchant,account,note,sources');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('1234.56');
      expect(lines[1]).toContain('Swiggy');
      expect(lines[1]).toContain('Food & Dining');
    });

    it('returns only the header when the ledger is empty', async () => {
      const res = await http().get('/v1/me/export').set(bearer(ravi)).expect(200);
      expect(res.text.trim()).toBe('date,amount,direction,type,category,merchant,account,note,sources');
    });

    it("never includes another user's transactions", async () => {
      await addTxn(asha, { merchantName: 'AshaOnlyMerchant' }).expect(201);
      const res = await http().get('/v1/me/export').set(bearer(ravi)).expect(200);
      expect(res.text).not.toContain('AshaOnlyMerchant');
    });
  });

  describe('DELETE /v1/me', () => {
    it('purges the user and all owned data even when an account has transactions (RESTRICT)', async () => {
      const account = await addAccount(asha).expect(201);
      await addTxn(asha, { accountId: account.body.id, categoryId: FOOD }).expect(201);
      await addTxn(asha, { accountId: account.body.id, amountPaise: 10_000 }).expect(201);

      await http().delete('/v1/me').set(bearer(asha)).expect(204);

      // Every owned row is gone; the other user is untouched.
      const prisma = app.get(PrismaService);
      expect(await prisma.user.findUnique({ where: { id: asha.user.id } })).toBeNull();
      expect(await prisma.account.count({ where: { userId: asha.user.id } })).toBe(0);
      expect(await prisma.transaction.count({ where: { userId: asha.user.id } })).toBe(0);
      expect(await prisma.transactionSource.count({ where: { userId: asha.user.id } })).toBe(0);
      expect(await prisma.refreshToken.count({ where: { userId: asha.user.id } })).toBe(0);
      expect(await prisma.user.count({ where: { id: ravi.user.id } })).toBe(1);
    });

    it('invalidates the session: a refresh with the deleted user token is rejected', async () => {
      await http().delete('/v1/me').set(bearer(asha)).expect(204);
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: asha.refreshToken, deviceId: 'device-0001' })
        .expect(401);
    });

    it('needs a token', async () => {
      await http().delete('/v1/me').expect(401);
    });
  });
});
