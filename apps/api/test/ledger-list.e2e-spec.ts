import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID, SYSTEM_CATEGORIES } from '@et/domain';
import { PrismaService } from '../src/common';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

const cat = (key: string) => SYSTEM_CATEGORIES.find((c) => c.key === key)!.id;
const FOOD = cat('food_dining');
const GROCERIES = cat('groceries');
const SHOPPING = cat('shopping');
const TRANSPORT = cat('transport');

interface Row {
  id: string;
  amountPaise: number;
  direction: 'debit' | 'credit';
  occurredAt: string;
  merchantName: string | null;
  category: { id: string };
}
interface Page {
  items: Row[];
  nextCursor: string | null;
  dayTotals: { date: string; debitPaise: number; creditPaise: number; netPaise: number }[];
}

describe('ledger: list, search, filters and categorization', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());

  const add = async (s: Session, body: Record<string, unknown> = {}): Promise<Row & { categorySource: string }> => {
    const res = await http()
      .post('/v1/transactions')
      .set(bearer(s))
      .send({ clientRequestId: randomUUID(), amountPaise: 10_000, direction: 'debit', occurredAt: '2026-10-31T07:42:00Z', ...body })
      .expect(201);
    return res.body;
  };

  const list = async (s: Session, query: Record<string, unknown> = {}): Promise<Page> =>
    (await http().get('/v1/transactions').query(query).set(bearer(s)).expect(200)).body;

  /** Every page, following nextCursor. */
  const all = async (s: Session, query: Record<string, unknown> = {}): Promise<Row[]> => {
    const rows: Row[] = [];
    let cursor: string | null = null;
    do {
      const page: Page = await list(s, { ...query, limit: 100, ...(cursor && { cursor }) });
      rows.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return rows;
  };

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/transactions', () => {
    it('pages newest first with no gaps or repeats, even when a row arrives mid-scroll', async () => {
      for (let i = 0; i < 7; i++) await add(asha, { occurredAt: `2026-10-2${i}T06:00:00Z`, merchantName: `Shop ${i}` });

      const first = await list(asha, { limit: 3 });
      expect(first.items.map((r) => r.merchantName)).toEqual(['Shop 6', 'Shop 5', 'Shop 4']);
      expect(first.nextCursor).toEqual(expect.any(String));

      await add(asha, { occurredAt: '2026-10-30T06:00:00Z', merchantName: 'New arrival' });

      const second = await list(asha, { limit: 3, cursor: first.nextCursor });
      const third = await list(asha, { limit: 3, cursor: second.nextCursor });
      expect([...second.items, ...third.items].map((r) => r.merchantName)).toEqual(['Shop 3', 'Shop 2', 'Shop 1', 'Shop 0']);
      expect(third.nextCursor).toBeNull();
    });

    it('breaks ties on the same minute by id', async () => {
      for (let i = 0; i < 4; i++) await add(asha, { merchantName: `Same ${i}` });
      const p1 = await list(asha, { limit: 2 });
      const p2 = await list(asha, { limit: 2, cursor: p1.nextCursor });
      const ids = [...p1.items, ...p2.items].map((r) => r.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toEqual([...ids].sort().reverse());
    });

    it('totals each IST day in full, even when the day spans two pages', async () => {
      await add(asha, { occurredAt: '2026-10-31T10:00:00Z', amountPaise: 48_600 });
      await add(asha, { occurredAt: '2026-10-30T19:00:00Z', amountPaise: 23_800 }); // 31 Oct, 00:30 IST
      await add(asha, { occurredAt: '2026-10-30T10:00:00Z', amountPaise: 7_500_000, direction: 'credit' });

      const page = await list(asha, { limit: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.dayTotals).toEqual([{ date: '2026-10-31', debitPaise: 72_400, creditPaise: 0, netPaise: -72_400 }]);

      const everything = await list(asha);
      expect(everything.dayTotals).toEqual([
        { date: '2026-10-31', debitPaise: 72_400, creditPaise: 0, netPaise: -72_400 },
        { date: '2026-10-30', debitPaise: 0, creditPaise: 7_500_000, netPaise: 7_500_000 },
      ]);
    });

    it('filters by direction, category, account, amount, date, type and source', async () => {
      const hdfc = (await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '1234' })).body;
      await add(asha, { merchantName: 'Swiggy', amountPaise: 48_600, accountId: hdfc.id, occurredAt: '2026-10-31T07:00:00Z' });
      await add(asha, { merchantName: 'Uber', amountPaise: 23_800, occurredAt: '2026-10-15T07:00:00Z' });
      await add(asha, { merchantName: 'Acme salary', amountPaise: 7_500_000, direction: 'credit', accountId: hdfc.id, occurredAt: '2026-09-30T19:00:00Z' });

      const names = async (q: Record<string, unknown>) => (await all(asha, q)).map((r) => r.merchantName);
      expect(await names({ direction: 'debit' })).toEqual(['Swiggy', 'Uber']);
      expect(await names({ categoryId: [FOOD, TRANSPORT] })).toEqual(['Swiggy', 'Uber']);
      expect(await names({ categoryId: TRANSPORT })).toEqual(['Uber']);
      expect(await names({ accountId: hdfc.id })).toEqual(['Swiggy', 'Acme salary']);
      expect(await names({ minAmountPaise: 30_000, maxAmountPaise: 100_000 })).toEqual(['Swiggy']);
      // 30 Sep 19:00 UTC is 1 Oct 00:30 IST: inside October.
      expect(await names({ from: '2026-10-01', to: '2026-10-15' })).toEqual(['Uber', 'Acme salary']);
      expect(await names({ type: 'income' })).toEqual(['Acme salary']);
      expect(await names({ source: 'manual' })).toHaveLength(3);
      expect(await names({ source: 'sms' })).toEqual([]);
    });

    it('searches merchant and note, any case, part of a word, with % and _ taken literally', async () => {
      await add(asha, { merchantName: 'Swiggy' });
      await add(asha, { merchantName: 'Cafe', note: 'Team lunch at 50% off' });
      await add(asha, { merchantName: 'Snack_bar' });
      await add(asha, { merchantName: 'Snackxbar' });

      const names = async (q: string) => (await all(asha, { q })).map((r) => r.merchantName).sort();
      expect(await names('swig')).toEqual(['Swiggy']);
      expect(await names('LUNCH')).toEqual(['Cafe']);
      expect(await names('50%')).toEqual(['Cafe']);
      expect(await names('%')).toEqual(['Cafe']);
      expect(await names('k_b')).toEqual(['Snack_bar']);
    });

    it('returns totals that match the rows for any filter combination', async () => {
      const amounts = [48_600, 23_800, 1_02_000, 21_800, 64_900];
      for (const [i, amountPaise] of amounts.entries()) {
        await add(asha, { amountPaise, merchantName: i % 2 ? 'Uber' : 'Swiggy', occurredAt: `2026-10-${10 + i}T05:00:00Z` });
      }
      await add(asha, { amountPaise: 7_500_000, direction: 'credit', merchantName: 'Salary', occurredAt: '2026-10-12T05:00:00Z' });

      for (const q of [{}, { direction: 'debit' }, { categoryId: FOOD }, { minAmountPaise: 30_000 }, { q: 'ub', from: '2026-10-11' }]) {
        const rows = await all(asha, q);
        const page = await list(asha, { ...q, limit: 100 });
        const net = rows.reduce((s, r) => s + (r.direction === 'credit' ? r.amountPaise : -r.amountPaise), 0);
        expect(page.dayTotals.reduce((s, d) => s + d.netPaise, 0)).toBe(net);
      }
    });

    it("never shows another user's rows", async () => {
      await add(asha, { merchantName: 'Swiggy' });
      expect((await list(ravi)).items).toEqual([]);
      expect((await list(ravi, { q: 'swiggy' })).dayTotals).toEqual([]);
    });

    it('rejects bad input', async () => {
      const bad = await http().get('/v1/transactions').query({ cursor: 'garbage' }).set(bearer(asha)).expect(400);
      expect(bad.body.error.code).toBe('INVALID_CURSOR');
      await http().get('/v1/transactions').query({ from: '2026-10-31', to: '2026-10-01' }).set(bearer(asha)).expect(400);
      await http().get('/v1/transactions').query({ from: '2026-02-30' }).set(bearer(asha)).expect(400);
      await http().get('/v1/transactions').query({ minAmountPaise: '12.5' }).set(bearer(asha)).expect(400);
      await http().get('/v1/transactions').query({ limit: 500 }).set(bearer(asha)).expect(400);
      await http().get('/v1/transactions').expect(401);
    });
  });

  describe('automatic categories', () => {
    it('uses the merchant list, keywords and the fallback', async () => {
      expect(await add(asha, { merchantName: 'Swiggy' })).toMatchObject({ category: { id: FOOD }, categorySource: 'rule' });
      expect(await add(asha, { merchantName: 'Acme Corp salary', direction: 'credit' })).toMatchObject({
        category: { id: INCOME_CATEGORY_ID },
        categorySource: 'rule',
      });
      expect(await add(asha, { merchantName: 'Sharma General Store' })).toMatchObject({
        category: { id: OTHER_CATEGORY_ID },
        categorySource: 'default',
      });
      expect(await add(asha, { merchantName: 'Swiggy', categoryId: SHOPPING })).toMatchObject({ category: { id: SHOPPING }, categorySource: 'user' });
    });

    it('re-categorizes when the merchant name is edited, unless the user chose the category', async () => {
      const t = await add(asha, { merchantName: 'Sharma General Store' });
      const edited = await http().patch(`/v1/transactions/${t.id}`).set(bearer(asha)).send({ merchantName: 'Uber' }).expect(200);
      expect(edited.body).toMatchObject({ category: { id: TRANSPORT }, categorySource: 'rule' });

      const mine = await add(asha, { merchantName: 'Sharma', categoryId: SHOPPING });
      const kept = await http().patch(`/v1/transactions/${mine.id}`).set(bearer(asha)).send({ merchantName: 'Uber' }).expect(200);
      expect(kept.body).toMatchObject({ category: { id: SHOPPING }, categorySource: 'user' });
    });
  });

  describe('PATCH /v1/transactions/:id/category', () => {
    it('applies to every automatic row from the merchant, and to new ones', async () => {
      const a = await add(asha, { merchantName: 'Swiggy', occurredAt: '2026-10-29T07:00:00Z' });
      const b = await add(asha, { merchantName: 'SWIGGY.', occurredAt: '2026-10-30T07:00:00Z' });
      const handPicked = await add(asha, { merchantName: 'swiggy', categoryId: SHOPPING });
      const other = await add(asha, { merchantName: 'Zomato' });
      const ravis = await add(ravi, { merchantName: 'Swiggy' });

      const res = await http()
        .patch(`/v1/transactions/${a.id}/category`)
        .set(bearer(asha))
        .send({ categoryId: GROCERIES, applyToMerchant: true })
        .expect(200);
      expect(res.body.updatedCount).toBe(1);
      expect(res.body.transaction).toMatchObject({ id: a.id, category: { id: GROCERIES }, categorySource: 'user' });

      const get = async (s: Session, id: string) => (await http().get(`/v1/transactions/${id}`).set(bearer(s))).body;
      expect(await get(asha, b.id)).toMatchObject({ category: { id: GROCERIES }, categorySource: 'rule' });
      expect(await get(asha, handPicked.id)).toMatchObject({ category: { id: SHOPPING }, categorySource: 'user' });
      expect(await get(asha, other.id)).toMatchObject({ category: { id: FOOD } });
      expect(await get(ravi, ravis.id)).toMatchObject({ category: { id: FOOD } });

      expect(await add(asha, { merchantName: 'Swiggy ' })).toMatchObject({ category: { id: GROCERIES }, categorySource: 'rule' });
      expect(await add(ravi, { merchantName: 'Swiggy' })).toMatchObject({ category: { id: FOOD } });

      const log = await app.get(PrismaService).categoryCorrection.findMany({ where: { userId: asha.user.id } });
      expect(log).toEqual([expect.objectContaining({ merchantKey: 'SWIGGY', fromCategoryId: FOOD, toCategoryId: GROCERIES, appliedToAll: true })]);
    });

    it('changes only this row without applyToMerchant', async () => {
      const a = await add(asha, { merchantName: 'Swiggy' });
      const b = await add(asha, { merchantName: 'Swiggy' });
      const res = await http().patch(`/v1/transactions/${a.id}/category`).set(bearer(asha)).send({ categoryId: GROCERIES }).expect(200);
      expect(res.body.updatedCount).toBe(0);
      expect((await http().get(`/v1/transactions/${b.id}`).set(bearer(asha))).body.category.id).toBe(FOOD);
      expect(await add(asha, { merchantName: 'Swiggy' })).toMatchObject({ category: { id: FOOD } });
    });

    it('needs a merchant to apply to all', async () => {
      const t = await add(asha);
      const res = await http()
        .patch(`/v1/transactions/${t.id}/category`)
        .set(bearer(asha))
        .send({ categoryId: GROCERIES, applyToMerchant: true })
        .expect(400);
      expect(res.body.error.code).toBe('MERCHANT_REQUIRED');
    });

    it("refuses another user's transaction or category", async () => {
      const t = await add(asha, { merchantName: 'Swiggy' });
      await http().patch(`/v1/transactions/${t.id}/category`).set(bearer(ravi)).send({ categoryId: GROCERIES }).expect(404);
      const pets = (await http().post('/v1/categories').set(bearer(ravi)).send({ name: 'Pets', icon: 'other', color: 'chart4' })).body;
      await http().patch(`/v1/transactions/${t.id}/category`).set(bearer(asha)).send({ categoryId: pets.id }).expect(404);
      await http().patch(`/v1/transactions/${t.id}/category`).set(bearer(asha)).send({ categoryId: 'nope' }).expect(400);
    });
  });
});
