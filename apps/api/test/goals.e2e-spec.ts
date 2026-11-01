import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays } from '@et/domain';
import { GoalsService } from '../src/goals';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

describe('goals', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  let today = '2026-11-01';
  const http = () => request(app.getHttpServer());
  const phone = () => ({ name: 'New phone', emoji: '📱', targetPaise: 5_000_000, targetDay: addDays(today, 90) });
  const createPhone = async (s = asha) => (await http().post('/v1/goals').set(bearer(s)).send(phone()).expect(201)).body as { id: string };
  const save = (id: string, amountPaise = 55_600, day?: 'today' | 'yesterday') =>
    http().post(`/v1/goals/${id}/contributions`).set(bearer(asha)).send({ amountPaise, ...(day ? { day } : {}) });

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    today = '2026-11-01';
    app.get(GoalsService).today = () => today;
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('sets a goal: ₹50,000 in 90 days is ₹556 a day', async () => {
    const res = await http().post('/v1/goals').set(bearer(asha)).send(phone()).expect(201);
    expect(res.body).toMatchObject({
      name: 'New phone',
      emoji: '📱',
      targetPaise: 5_000_000,
      startDay: '2026-11-01',
      targetDay: '2027-01-30',
      status: 'active',
      progress: { dailyTargetPaise: 55_600, suggestedTodayPaise: 55_600, daysLeft: 90, daysCloser: 0, daysToGo: 90, streak: 0 },
    });
    const list = await http().get('/v1/goals').set(bearer(asha)).expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('builds a streak day by day, and a missed day breaks it', async () => {
    const { id } = await createPhone();
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      today = day;
      await save(id).expect(201);
    }
    let goal = (await http().get(`/v1/goals/${id}`).set(bearer(asha)).expect(200)).body;
    expect(goal.progress).toMatchObject({ savedPaise: 166_800, daysCloser: 3, daysToGo: 87, streak: 3, scheduleDelta: 0 });
    expect(goal.progress.milestones).toEqual(['streak-3']);
    expect(goal.contributions.map((c: { day: string }) => c.day)).toEqual(['2026-11-03', '2026-11-02', '2026-11-01']);

    today = '2026-11-05';
    goal = (await http().get(`/v1/goals/${id}`).set(bearer(asha)).expect(200)).body;
    expect(goal.progress).toMatchObject({ streak: 0, bestStreak: 3, scheduleDelta: -1 });
  });

  it('says which milestones a contribution reached, and marks the goal reached once', async () => {
    const { id } = await createPhone();
    const half = await save(id, 2_500_000).expect(201);
    expect(half.body.newMilestones).toEqual(['saved-25', 'saved-50']);
    const rest = await save(id, 2_500_000).expect(201);
    expect(rest.body.newMilestones).toEqual(['saved-75', 'saved-100']);
    expect(rest.body.goal).toMatchObject({ status: 'reached', reachedAt: expect.any(String), progress: { reached: true, remainingPaise: 0 } });
    const again = await save(id).expect(409);
    expect(again.body.error.code).toBe('GOAL_REACHED');
  });

  it('logs yesterday when it was missed, but nothing before the goal started', async () => {
    const { id } = await createPhone();
    const before = await save(id, 55_600, 'yesterday').expect(400);
    expect(before.body.error.code).toBe('VALIDATION_FAILED');
    today = '2026-11-02';
    const res = await save(id, 55_600, 'yesterday').expect(201);
    expect(res.body.goal.progress.last14.slice(-2)).toEqual([
      { day: '2026-11-01', status: 'met' },
      { day: '2026-11-02', status: 'pending' },
    ]);
  });

  it('takes back a contribution, and a goal below its target is active again', async () => {
    const { id } = await createPhone();
    const res = await save(id, 5_000_000).expect(201);
    expect(res.body.goal.status).toBe('reached');
    const detail = (await http().get(`/v1/goals/${id}`).set(bearer(asha)).expect(200)).body;
    const back = await http().delete(`/v1/goals/${id}/contributions/${detail.contributions[0].id}`).set(bearer(asha)).expect(200);
    expect(back.body).toMatchObject({ status: 'active', reachedAt: null, progress: { savedPaise: 0 } });
  });

  it('edits, archives and restores; an archived goal takes no money', async () => {
    const { id } = await createPhone();
    const edited = await http().patch(`/v1/goals/${id}`).set(bearer(asha)).send({ name: 'Pixel 9', targetPaise: 6_000_000 }).expect(200);
    expect(edited.body).toMatchObject({ name: 'Pixel 9', targetPaise: 6_000_000, progress: { dailyTargetPaise: 66_700 } });
    await http().patch(`/v1/goals/${id}`).set(bearer(asha)).send({ status: 'archived' }).expect(200);
    expect((await save(id).expect(409)).body.error.code).toBe('GOAL_ARCHIVED');
    const archived = await http().get('/v1/goals?status=archived').set(bearer(asha)).expect(200);
    expect(archived.body.items).toHaveLength(1);
    await http().patch(`/v1/goals/${id}`).set(bearer(asha)).send({ status: 'active' }).expect(200);
    await save(id).expect(201);
  });

  it('turns away deadlines that are past, today or more than 10 years away, and bad amounts', async () => {
    for (const targetDay of [today, '2026-10-31', addDays(today, 3651), '2026-02-30', 'soon']) {
      await http().post('/v1/goals').set(bearer(asha)).send({ ...phone(), targetDay }).expect(400);
    }
    for (const targetPaise of [0, 99, 1.5, -100]) {
      await http().post('/v1/goals').set(bearer(asha)).send({ ...phone(), targetPaise }).expect(400);
    }
    const { id } = await createPhone();
    for (const amountPaise of [0, -1, 12.5]) await save(id, amountPaise).expect(400);
    await save(id, 100, 'tomorrow' as never).expect(400);
  });

  it('allows 10 active goals at a time', async () => {
    for (let i = 0; i < 10; i++) await createPhone();
    const res = await http().post('/v1/goals').set(bearer(asha)).send(phone()).expect(409);
    expect(res.body.error.code).toBe('GOAL_LIMIT');
  });

  it("never shows or changes another user's goal", async () => {
    const { id } = await createPhone();
    await http().get(`/v1/goals/${id}`).set(bearer(ravi)).expect(404);
    await http().patch(`/v1/goals/${id}`).set(bearer(ravi)).send({ name: 'Mine now' }).expect(404);
    await http().post(`/v1/goals/${id}/contributions`).set(bearer(ravi)).send({ amountPaise: 100 }).expect(404);
    await http().delete(`/v1/goals/${id}`).set(bearer(ravi)).expect(404);
    expect((await http().get('/v1/goals').set(bearer(ravi)).expect(200)).body.items).toEqual([]);
    await save(id).expect(201);
    const contribution = (await http().get(`/v1/goals/${id}`).set(bearer(asha)).expect(200)).body.contributions[0].id;
    await http().delete(`/v1/goals/${id}/contributions/${contribution}`).set(bearer(ravi)).expect(404);
  });

  it('deletes goals with the account', async () => {
    const { id } = await createPhone();
    await save(id).expect(201);
    await http().delete('/v1/me').set(bearer(asha)).expect(204);
    const prisma = app.get((await import('../src/common')).PrismaService);
    expect(await prisma.goal.count()).toBe(0);
    expect(await prisma.goalContribution.count()).toBe(0);
  });

  it('deletes a goal and its contributions', async () => {
    const { id } = await createPhone();
    await save(id).expect(201);
    await http().delete(`/v1/goals/${id}`).set(bearer(asha)).expect(204);
    await http().get(`/v1/goals/${id}`).set(bearer(asha)).expect(404);
  });
});
