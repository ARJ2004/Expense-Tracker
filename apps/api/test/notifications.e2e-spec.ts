import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays, SYSTEM_CATEGORIES } from '@et/domain';
import { BudgetsService } from '../src/budgets';
import { PrismaService } from '../src/common';
import { GoalsService } from '../src/goals';
import { NotificationJobs } from '../src/notifications/notification-jobs';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PUSH_SENDER, type PushMessage, type PushSender } from '../src/notifications/push/push-sender';
import { RewardsService } from '../src/rewards';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { Test } from '@nestjs/testing';
import { bearer, resetDb, signIn, type Session } from './helpers';

const FOOD = SYSTEM_CATEGORIES.find((c) => c.key === 'food_dining')!.id;

/** Records pushes instead of calling FCM. */
class FakeSender implements PushSender {
  readonly enabled = true;
  sent: PushMessage[] = [];
  async send(m: PushMessage) {
    this.sent.push(m);
    return m.token.startsWith('dead') ? ('invalid' as const) : ('sent' as const);
  }
}

/** Waits for the async event listeners to write what a test expects. */
async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  return fn();
}

describe('rewards and notifications', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  let sender: FakeSender;
  let today = '2026-11-11';
  let hour = 12;
  const http = () => request(app.getHttpServer());
  const inbox = (s: Session = asha) => http().get('/v1/notifications').set(bearer(s)).expect(200).then((r) => r.body as { unreadCount: number; items: { type: string; title: string; body: string }[] });
  const spend = (amountPaise: number, day = today, s = asha) =>
    http()
      .post('/v1/transactions')
      .set(bearer(s))
      .send({ clientRequestId: randomUUID(), amountPaise, direction: 'debit', occurredAt: `${day}T06:30:00Z`, categoryId: FOOD })
      .expect(201);
  const TOKEN = 'fcm-token-asha-0000000001';

  beforeEach(async () => {
    sender = new FakeSender();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PUSH_SENDER).useValue(sender).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    await resetDb(app);
    today = '2026-11-11';
    hour = 12;
    for (const svc of [BudgetsService, GoalsService, RewardsService]) app.get(svc).today = () => today;
    app.get(NotificationsService).now = () => new Date(Date.parse(`${today}T${String(hour).padStart(2, '0')}:00:00+05:30`));
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a phone, pushes to it, and stops after sign-out', async () => {
    await http().post('/v1/devices').set(bearer(asha)).send({ token: TOKEN, platform: 'android' }).expect(204);
    expect((await http().post('/v1/notifications/test').set(bearer(asha)).expect(201)).body).toEqual({ result: 'sent' });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ token: TOKEN, title: 'Notifications are working 🎉' });

    await http().post('/v1/devices/unregister').set(bearer(asha)).send({ token: TOKEN }).expect(204);
    expect((await http().post('/v1/notifications/test').set(bearer(asha)).expect(201)).body).toEqual({ result: 'no_device' });
  });

  it('drops a token FCM says is dead', async () => {
    await http().post('/v1/devices').set(bearer(asha)).send({ token: 'dead-token-000000000000001', platform: 'android' }).expect(204);
    expect((await http().post('/v1/notifications/test').set(bearer(asha)).expect(201)).body).toEqual({ result: 'failed' });
    expect(await app.get(PrismaService).device.count()).toBe(0);
  });

  it('awards the first-budget badge with a push, once', async () => {
    await http().post('/v1/devices').set(bearer(asha)).send({ token: TOKEN, platform: 'android' }).expect(204);
    await http().put(`/v1/budgets/${FOOD}`).set(bearer(asha)).send({ amountPaise: 1_000_000 }).expect(200);
    await http().put(`/v1/budgets/${FOOD}`).set(bearer(asha)).send({ amountPaise: 900_000 }).expect(200);
    const box = await eventually(inbox, (b) => b.items.length > 0);
    expect(box.items.map((i) => i.title)).toEqual(['🎯 Badge unlocked: Planner']);
    const rewards = (await http().get('/v1/rewards').set(bearer(asha)).expect(200)).body;
    expect(rewards.badges.find((b: { code: string }) => b.code === 'first_budget').unlockedAt).not.toBeNull();
    expect(rewards.badges.find((b: { code: string }) => b.code === 'streak_3').unlockedAt).toBeNull();
    expect(sender.sent).toHaveLength(1);
  });

  it('alerts once when a spend takes a budget past 80%, in the inbox even without a phone', async () => {
    await app.get(PrismaService).budget.create({ data: { userId: asha.user.id, categoryId: FOOD, amountPaise: 100_000n } });
    await spend(50_000);
    await spend(35_000);
    let box = await eventually(inbox, (b) => b.items.length > 0);
    expect(box.items[0]).toMatchObject({ type: 'budget_threshold', title: 'Food & Dining is at 80%', body: '₹150 left for 20 days' });
    await spend(1_000);
    box = await inbox();
    expect(box.items.filter((i) => i.type === 'budget_threshold')).toHaveLength(1);
    expect(box.unreadCount).toBe(1);
    await http().post('/v1/notifications/read').set(bearer(asha)).expect(204);
    expect((await inbox()).unreadCount).toBe(0);
    expect((await inbox(ravi)).items).toHaveLength(0);
  });

  it('never alerts for an old payment, like a statement row from last month', async () => {
    await app.get(PrismaService).budget.create({ data: { userId: asha.user.id, categoryId: FOOD, amountPaise: 100_000n } });
    await spend(95_000, '2026-11-02');
    await new Promise((r) => setTimeout(r, 300));
    expect((await inbox()).items).toHaveLength(0);
  });

  it('holds pushes in quiet hours and skips types the user switched off', async () => {
    await http().post('/v1/devices').set(bearer(asha)).send({ token: TOKEN, platform: 'android' }).expect(204);
    await http().patch('/v1/me').set(bearer(asha)).send({ monthlyIncomePaise: 6_000_000 }).expect(200);
    const jobs = app.get(NotificationJobs);

    hour = 23;
    await jobs.run('notify-morning-allowance', [asha.user.id]);
    expect(sender.sent).toHaveLength(0);
    expect((await inbox()).items[0]).toMatchObject({ type: 'morning_allowance', title: 'You can spend ₹3,000 today' });

    const settings = await http().put('/v1/notifications/settings').set(bearer(asha)).send({ disabledTypes: ['daily_summary'] }).expect(200);
    expect(settings.body.items.find((i: { type: string }) => i.type === 'daily_summary')).toMatchObject({ enabled: false, group: 'daily' });
    hour = 21;
    await spend(10_000);
    await jobs.run('notify-daily-summary', [asha.user.id]);
    expect((await inbox()).items.some((i) => i.type === 'daily_summary')).toBe(false);
    await http().put('/v1/notifications/settings').set(bearer(asha)).send({ disabledTypes: ['nonsense'] }).expect(400);
  });

  it('sends the evening summary against the allowance', async () => {
    await http().patch('/v1/me').set(bearer(asha)).send({ monthlyIncomePaise: 6_000_000 }).expect(200);
    await spend(240_000);
    hour = 21;
    await app.get(NotificationJobs).run('notify-daily-summary', [asha.user.id]);
    const box = await inbox();
    expect(box.items.find((i) => i.type === 'daily_summary')).toMatchObject({ title: 'Today ₹2,400 · ₹600 under 🎯' });
  });

  it('closes days into a streak, with a push and a badge at 3', async () => {
    await http().patch('/v1/me').set(bearer(asha)).send({ monthlyIncomePaise: 6_000_000 }).expect(200);
    const rewards = app.get(RewardsService);
    for (const day of ['2026-11-08', '2026-11-09', '2026-11-10']) {
      await spend(100_000, day);
      await rewards.closeDay(asha.user.id, day);
    }
    await rewards.closeDay(asha.user.id, '2026-11-10');
    const summary = (await http().get('/v1/rewards').set(bearer(asha)).expect(200)).body;
    expect(summary.streak).toEqual({ current: 3, best: 3 });
    expect(summary.last14).toHaveLength(3);
    expect(summary.last14[0]).toMatchObject({ day: '2026-11-08', spentPaise: 100_000, underBudget: true });
    expect(summary.badges.find((b: { code: string }) => b.code === 'streak_3').unlockedAt).not.toBeNull();
    const box = await eventually(inbox, (b) => b.items.some((i) => i.type === 'streak_milestone'));
    expect(box.items.filter((i) => i.type === 'streak_milestone').map((i) => i.title)).toEqual(['🔥 3-day streak!']);
    expect(box.items.some((i) => i.title.includes('Badge unlocked: 3-day'))).toBe(false);

    // A day over the allowance ends it.
    today = '2026-11-12';
    await spend(900_000, '2026-11-11');
    await rewards.closeDay(asha.user.id, '2026-11-11');
    expect((await http().get('/v1/rewards').set(bearer(asha)).expect(200)).body.streak).toEqual({ current: 0, best: 3 });
  });

  it('celebrates a goal milestone with one push', async () => {
    const goal = (await http().post('/v1/goals').set(bearer(asha)).send({ name: 'Trip', emoji: '🏖️', targetPaise: 100_000, targetDay: addDays(today, 10) }).expect(201)).body;
    await http().post(`/v1/goals/${goal.id}/contributions`).set(bearer(asha)).send({ amountPaise: 60_000 }).expect(201);
    const box = await eventually(inbox, (b) => b.items.some((i) => i.type === 'goal_milestone'));
    expect(box.items.filter((i) => i.type === 'goal_milestone').map((i) => i.title)).toEqual(['🏖️ Trip: 50% saved']);
    expect(box.items.some((i) => i.title === '🌱 Badge unlocked: Saver')).toBe(true);
  });
});
