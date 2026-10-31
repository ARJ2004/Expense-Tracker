import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID, SYSTEM_CATEGORIES } from '@et/domain';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

const FOOD = SYSTEM_CATEGORIES[0]!.id;
const TRANSPORT = SYSTEM_CATEGORIES[2]!.id;

describe('ledger: categories, accounts, transactions', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());

  const add = (s: Session, body: Record<string, unknown> = {}) =>
    http()
      .post('/v1/transactions')
      .set(bearer(s))
      .send({ clientRequestId: randomUUID(), amountPaise: 48_600, direction: 'debit', occurredAt: '2026-10-31T07:42:00Z', ...body });

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/v1/categories', () => {
    it('lists the 14 system categories in order', async () => {
      const res = await http().get('/v1/categories').set(bearer(asha)).expect(200);
      expect(res.body.items).toHaveLength(14);
      expect(res.body.items[0]).toEqual({ id: FOOD, name: 'Food & Dining', icon: 'food', color: 'chart2', isExpense: true, system: true });
      expect(res.body.items.at(-1).name).toBe('Other');
    });

    it('creates, renames and deletes a custom category, scoped to its owner', async () => {
      const created = await http().post('/v1/categories').set(bearer(asha)).send({ name: ' Pets ', icon: 'other', color: 'chart4' }).expect(201);
      expect(created.body).toMatchObject({ name: 'Pets', system: false, isExpense: true });
      const id = created.body.id;

      expect((await http().get('/v1/categories').set(bearer(ravi))).body.items).toHaveLength(14);
      await http().patch(`/v1/categories/${id}`).set(bearer(ravi)).send({ name: 'Mine' }).expect(404);
      await http().patch(`/v1/categories/${id}`).set(bearer(asha)).send({ name: 'Pet care' }).expect(200);
      await http().delete(`/v1/categories/${id}`).set(bearer(ravi)).expect(404);
      await http().delete(`/v1/categories/${id}`).set(bearer(asha)).expect(204);
    });

    it('refuses duplicates and system names', async () => {
      await http().post('/v1/categories').set(bearer(asha)).send({ name: 'Pets', icon: 'other', color: 'chart4' }).expect(201);
      const dup = await http().post('/v1/categories').set(bearer(asha)).send({ name: 'Pets', icon: 'other', color: 'chart4' }).expect(409);
      expect(dup.body.error.code).toBe('CATEGORY_EXISTS');
      await http().post('/v1/categories').set(bearer(asha)).send({ name: 'food & dining', icon: 'food', color: 'chart2' }).expect(409);
    });

    it('protects system categories', async () => {
      const res = await http().patch(`/v1/categories/${FOOD}`).set(bearer(asha)).send({ name: 'Eating' }).expect(403);
      expect(res.body.error.code).toBe('CATEGORY_SYSTEM');
      await http().delete(`/v1/categories/${OTHER_CATEGORY_ID}`).set(bearer(asha)).expect(403);
    });

    it('validates icon and colour', async () => {
      await http().post('/v1/categories').set(bearer(asha)).send({ name: 'X', icon: 'rocket', color: '#ff0000' }).expect(400);
    });

    it('moves transactions of a deleted category to Other', async () => {
      const pets = await http().post('/v1/categories').set(bearer(asha)).send({ name: 'Pets', icon: 'other', color: 'chart4' });
      const t = await add(asha, { categoryId: pets.body.id }).expect(201);
      await http().delete(`/v1/categories/${pets.body.id}`).set(bearer(asha)).expect(204);
      const after = await http().get(`/v1/transactions/${t.body.id}`).set(bearer(asha)).expect(200);
      expect(after.body.category.id).toBe(OTHER_CATEGORY_ID);
      expect(after.body.categorySource).toBe('default');
    });
  });

  describe('/v1/accounts/:id', () => {
    it('edits and deletes an unused account', async () => {
      const a = await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '1234' });
      const edited = await http().patch(`/v1/accounts/${a.body.id}`).set(bearer(asha)).send({ nickname: 'Salary' }).expect(200);
      expect(edited.body).toMatchObject({ bankName: 'HDFC Bank', nickname: 'Salary' });
      await http().patch(`/v1/accounts/${a.body.id}`).set(bearer(asha)).send({ maskedNumber: '4111111111111111' }).expect(400);
      await http().delete(`/v1/accounts/${a.body.id}`).set(bearer(asha)).expect(204);
    });

    it("never touches another user's account", async () => {
      const a = await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings' });
      await http().patch(`/v1/accounts/${a.body.id}`).set(bearer(ravi)).send({ nickname: 'x' }).expect(404);
      await http().delete(`/v1/accounts/${a.body.id}`).set(bearer(ravi)).expect(404);
    });

    it('refuses to delete an account that has transactions', async () => {
      const a = await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings' });
      await add(asha, { accountId: a.body.id }).expect(201);
      const res = await http().delete(`/v1/accounts/${a.body.id}`).set(bearer(asha)).expect(409);
      expect(res.body.error.code).toBe('ACCOUNT_IN_USE');
    });
  });

  describe('POST /v1/transactions', () => {
    it('creates a manual debit with its source', async () => {
      const a = await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '1234' });
      const res = await add(asha, { accountId: a.body.id, categoryId: FOOD, merchantName: ' Swiggy ', note: 'Team lunch' }).expect(201);
      expect(res.body).toMatchObject({
        amountPaise: 48_600,
        direction: 'debit',
        type: 'expense',
        occurredAt: '2026-10-31T07:42:00.000Z',
        merchantName: 'Swiggy',
        note: 'Team lunch',
        categorySource: 'user',
        userEdited: false,
        category: { id: FOOD, name: 'Food & Dining' },
        account: { id: a.body.id, bankName: 'HDFC Bank', maskedNumber: '1234' },
      });
      expect(res.body.sources).toEqual([{ source: 'manual', receivedAt: expect.any(String) }]);
    });

    it('is idempotent by clientRequestId', async () => {
      const clientRequestId = randomUUID();
      const first = await add(asha, { clientRequestId }).expect(201);
      const again = await add(asha, { clientRequestId }).expect(200);
      expect(again.body.id).toBe(first.body.id);
      const recent = await http().get('/v1/transactions/recent').set(bearer(asha)).expect(200);
      expect(recent.body.items).toHaveLength(1);
    });

    it('defaults the category to Other for debits and Income for credits', async () => {
      const debit = await add(asha).expect(201);
      expect(debit.body).toMatchObject({ category: { id: OTHER_CATEGORY_ID }, categorySource: 'default' });
      const credit = await add(asha, { direction: 'credit' }).expect(201);
      expect(credit.body).toMatchObject({ category: { id: INCOME_CATEGORY_ID }, type: 'income' });
    });

    it.each([
      ['zero', { amountPaise: 0 }],
      ['fractional paise', { amountPaise: 486.5 }],
      ['too large', { amountPaise: 1e13 }],
      ['a string amount', { amountPaise: '48600' }],
      ['a bad direction', { direction: 'out' }],
      ['a user id', { userId: '00000000-0000-7000-8000-000000000001' }],
      ['no request id', { clientRequestId: undefined }],
    ])('rejects %s', async (_label, body) => {
      const res = await add(asha, body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects a date more than a day ahead', async () => {
      await add(asha, { occurredAt: new Date(Date.now() + 2 * 86_400_000).toISOString() }).expect(400);
    });

    it("404s on another user's account or category", async () => {
      const raviAccount = await http().post('/v1/accounts').set(bearer(ravi)).send({ bankName: 'SBI', kind: 'savings' });
      const raviCat = await http().post('/v1/categories').set(bearer(ravi)).send({ name: 'Pets', icon: 'other', color: 'chart4' });
      await add(asha, { accountId: raviAccount.body.id }).expect(404);
      await add(asha, { categoryId: raviCat.body.id }).expect(404);
    });
  });

  describe('/v1/transactions/:id', () => {
    it('edits: amount, date or merchant set userEdited; a category pick sets source user', async () => {
      const t = await add(asha).expect(201);
      const noteOnly = await http().patch(`/v1/transactions/${t.body.id}`).set(bearer(asha)).send({ note: 'lunch' }).expect(200);
      expect(noteOnly.body).toMatchObject({ note: 'lunch', userEdited: false });

      const cat = await http().patch(`/v1/transactions/${t.body.id}`).set(bearer(asha)).send({ categoryId: TRANSPORT }).expect(200);
      expect(cat.body).toMatchObject({ category: { id: TRANSPORT }, categorySource: 'user', userEdited: false });

      const amount = await http().patch(`/v1/transactions/${t.body.id}`).set(bearer(asha)).send({ amountPaise: 50_000 }).expect(200);
      expect(amount.body).toMatchObject({ amountPaise: 50_000, userEdited: true });

      const cleared = await http().patch(`/v1/transactions/${t.body.id}`).set(bearer(asha)).send({ note: '' }).expect(200);
      expect(cleared.body.note).toBeNull();
    });

    it('flipping direction moves a default category between Other and Income', async () => {
      const t = await add(asha).expect(201);
      const res = await http().patch(`/v1/transactions/${t.body.id}`).set(bearer(asha)).send({ direction: 'credit' }).expect(200);
      expect(res.body).toMatchObject({ direction: 'credit', type: 'income', category: { id: INCOME_CATEGORY_ID } });
    });

    it('soft-deletes, and replaying the original request does not revive it', async () => {
      const clientRequestId = randomUUID();
      const t = await add(asha, { clientRequestId }).expect(201);
      await http().delete(`/v1/transactions/${t.body.id}`).set(bearer(asha)).expect(204);
      await http().get(`/v1/transactions/${t.body.id}`).set(bearer(asha)).expect(404);
      await http().delete(`/v1/transactions/${t.body.id}`).set(bearer(asha)).expect(404);
      await add(asha, { clientRequestId }).expect(404);
      expect((await http().get('/v1/transactions/recent').set(bearer(asha))).body.items).toEqual([]);
    });

    it("404s for another user's transaction", async () => {
      const t = await add(asha).expect(201);
      await http().get(`/v1/transactions/${t.body.id}`).set(bearer(ravi)).expect(404);
      await http().patch(`/v1/transactions/${t.body.id}`).set(bearer(ravi)).send({ note: 'x' }).expect(404);
      await http().delete(`/v1/transactions/${t.body.id}`).set(bearer(ravi)).expect(404);
      expect((await http().get('/v1/transactions/recent').set(bearer(ravi))).body.items).toEqual([]);
    });

    it('rejects a malformed id', async () => {
      await http().get('/v1/transactions/not-a-uuid').set(bearer(asha)).expect(400);
    });
  });

  describe('recent lists', () => {
    it('orders transactions newest first and categories by last pick', async () => {
      await add(asha, { occurredAt: '2026-10-30T07:00:00Z', categoryId: TRANSPORT }).expect(201);
      await add(asha, { occurredAt: '2026-10-31T07:00:00Z', categoryId: FOOD }).expect(201);
      await add(asha, { occurredAt: '2026-10-29T07:00:00Z' }).expect(201);
      const recent = await http().get('/v1/transactions/recent?limit=2').set(bearer(asha)).expect(200);
      expect(recent.body.items.map((t: { occurredAt: string }) => t.occurredAt)).toEqual(['2026-10-31T07:00:00.000Z', '2026-10-30T07:00:00.000Z']);
      const cats = await http().get('/v1/transactions/recent-categories').set(bearer(asha)).expect(200);
      expect(cats.body.ids).toEqual([FOOD, TRANSPORT]);
    });
  });
});
