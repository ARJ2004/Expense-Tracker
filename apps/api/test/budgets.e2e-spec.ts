import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { SYSTEM_CATEGORIES } from '@et/domain';
import { BudgetsService } from '../src/budgets';
import { GoalsService } from '../src/goals';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

const cat = (key: string) => SYSTEM_CATEGORIES.find((c) => c.key === key)!.id;
const FOOD = cat('food_dining');
const RENT = cat('rent');
const SHOPPING = cat('shopping');
const INCOME = cat('income');

describe('budgets', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const today = '2026-11-11';
  const http = () => request(app.getHttpServer());
  const spend = (s: Session, amountPaise: number, categoryId: string, day = today) =>
    http()
      .post('/v1/transactions')
      .set(bearer(s))
      .send({ clientRequestId: randomUUID(), amountPaise, direction: 'debit', occurredAt: `${day}T06:30:00Z`, categoryId })
      .expect(201);
  const setBudget = (s: Session, categoryId: string, amountPaise: number, isFixed?: boolean) =>
    http().put(`/v1/budgets/${categoryId}`).set(bearer(s)).send({ amountPaise, ...(isFixed !== undefined ? { isFixed } : {}) });

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    app.get(BudgetsService).today = () => today;
    app.get(GoalsService).today = () => today;
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('shows each budget with its spend, state and pace, and today’s allowance', async () => {
    await http().patch('/v1/me').set(bearer(asha)).send({ monthlyIncomePaise: 7_500_000 }).expect(200);
    await setBudget(asha, FOOD, 1_000_000).expect(200);
    await setBudget(asha, RENT, 1_500_000, true).expect(200);
    await spend(asha, 850_000, FOOD, '2026-11-05');
    await spend(asha, 50_000, FOOD, '2026-11-08');
    await spend(asha, 30_000, SHOPPING);

    const res = await http().get('/v1/budgets').set(bearer(asha)).expect(200);
    expect(res.body.month).toBe('2026-11');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      category: { id: FOOD, name: 'Food & Dining' },
      amountPaise: 1_000_000,
      isFixed: false,
      spentPaise: 900_000,
      usedPercent: 90,
      state: 'warning',
      projectedPaise: Math.round((900_000 * 30) / 11),
    });
    expect(res.body.items[0].overshootPaise).toBeGreaterThan(0);
    expect(res.body.items[1]).toMatchObject({ category: { id: RENT }, isFixed: true, spentPaise: 0, state: 'ok', projectedPaise: null });
    expect(res.body).toMatchObject({ totalBudgetPaise: 2_500_000, totalSpentPaise: 900_000, unbudgetedSpentPaise: 30_000 });
    // (75,000 − 15,000 rent − 9,000 food before today) ÷ 20 days = ₹2,550; ₹300 shopping today.
    expect(res.body.allowance).toEqual({
      day: today,
      allowancePaise: 255_000,
      spentTodayPaise: 30_000,
      leftTodayPaise: 225_000,
      daysLeft: 20,
      basis: 'income',
      fixedReservePaise: 1_500_000,
      goalReservePaise: 0,
    });
  });

  it('holds back what goals ask for, and uses the budgets when there is no income', async () => {
    await setBudget(asha, FOOD, 600_000).expect(200);
    let allowance = (await http().get('/v1/budgets').set(bearer(asha)).expect(200)).body.allowance;
    // ₹6,000 over 20 days.
    expect(allowance).toMatchObject({ basis: 'budgets', allowancePaise: 30_000 });

    await http().post('/v1/goals').set(bearer(asha)).send({ name: 'Trip', targetPaise: 200_000, targetDay: '2026-11-21' }).expect(201);
    allowance = (await http().get('/v1/budgets').set(bearer(asha)).expect(200)).body.allowance;
    // ₹2,000 over 10 days is ₹200 a day, all of it this month: (6,000 − 2,000) ÷ 20 = ₹200.
    expect(allowance).toMatchObject({ goalReservePaise: 200_000, allowancePaise: 20_000 });
  });

  it('has no allowance without an income or a budget, and none for past months', async () => {
    expect((await http().get('/v1/budgets').set(bearer(asha)).expect(200)).body).toMatchObject({ items: [], allowance: null });
    await setBudget(asha, FOOD, 600_000).expect(200);
    expect((await http().get('/v1/budgets?month=2026-10').set(bearer(asha)).expect(200)).body.allowance).toBeNull();
  });

  it('changes and removes a budget, and validates the input', async () => {
    await setBudget(asha, FOOD, 600_000).expect(200);
    const changed = await setBudget(asha, FOOD, 800_000, true).expect(200);
    expect(changed.body).toMatchObject({ amountPaise: 800_000, isFixed: true });
    await setBudget(asha, FOOD, 0).expect(400);
    await setBudget(asha, FOOD, 12.5).expect(400);
    expect((await setBudget(asha, INCOME, 100_000).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    await http().delete(`/v1/budgets/${FOOD}`).set(bearer(asha)).expect(204);
    await http().delete(`/v1/budgets/${FOOD}`).set(bearer(asha)).expect(404);
  });

  it("never shows or touches another user's budgets or categories", async () => {
    await setBudget(asha, FOOD, 600_000).expect(200);
    await spend(asha, 10_000, FOOD);
    expect((await http().get('/v1/budgets').set(bearer(ravi)).expect(200)).body).toMatchObject({ items: [], totalSpentPaise: 0, allowance: null });
    await http().delete(`/v1/budgets/${FOOD}`).set(bearer(ravi)).expect(404);

    const pets = await http().post('/v1/categories').set(bearer(asha)).send({ name: 'Pets', icon: 'other', color: 'muted' }).expect(201);
    await setBudget(ravi, pets.body.id, 100_000).expect(404);
  });
});
