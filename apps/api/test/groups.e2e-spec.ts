import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common';
import { GroupsService } from '../src/groups';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

interface Member {
  id: string;
  name: string;
  isSelf: boolean;
}

describe('groups', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const today = '2026-11-21';
  const http = () => request(app.getHttpServer());

  /** Goa trip with You, Ravi, Priya and Arjun; returns the group id and members by name. */
  const goaTrip = async (s = asha) => {
    const res = await http()
      .post('/v1/groups')
      .set(bearer(s))
      .send({ name: 'Goa trip', emoji: '🏖️', members: ['Ravi', 'Priya', 'Arjun'] })
      .expect(201);
    const by = Object.fromEntries((res.body.members as Member[]).map((m) => [m.name, m.id])) as Record<string, string>;
    return { id: res.body.id as string, you: by.You as string, ravi: by.Ravi as string, priya: by.Priya as string, arjun: by.Arjun as string };
  };
  const expense = (groupId: string, body: object, s = asha) => http().post(`/v1/groups/${groupId}/expenses`).set(bearer(s)).send(body);
  const detail = async (groupId: string) => (await http().get(`/v1/groups/${groupId}`).set(bearer(asha)).expect(200)).body;

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    app.get(GroupsService).today = () => today;
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a group with the caller as "You" first', async () => {
    const res = await http().post('/v1/groups').set(bearer(asha)).send({ name: '  Goa   trip ', members: ['Ravi', 'Priya'] }).expect(201);
    expect(res.body).toMatchObject({ name: 'Goa trip', archived: false, settled: true, totalSpentPaise: 0, myNetPaise: 0, transfers: [] });
    expect(res.body.members.map((m: Member) => [m.name, m.isSelf])).toEqual([
      ['You', true],
      ['Ravi', false],
      ['Priya', false],
    ]);
    const list = await http().get('/v1/groups').set(bearer(asha)).expect(200);
    expect(list.body.items).toEqual([{ id: res.body.id, name: 'Goa trip', emoji: null, memberCount: 3, myNetPaise: 0, archived: false }]);
  });

  it('splits the Goa trip and says who pays whom, then settles up', async () => {
    const g = await goaTrip();
    const dinner = await expense(g.id, {
      description: "Dinner at Fisherman's Wharf",
      amountPaise: 3600_00,
      day: '2026-11-20',
      paidById: g.priya,
      splitMode: 'equal',
      memberIds: [g.arjun, g.you, g.ravi, g.priya],
    }).expect(201);
    expect(dinner.body).toMatchObject({ kind: 'expense', amountPaise: 3600_00, paidById: g.priya, splitMode: 'equal' });
    await expense(g.id, {
      description: 'Cab to the airport',
      amountPaise: 1200_00,
      day: today,
      paidById: g.you,
      splitMode: 'exact',
      shares: [
        { memberId: g.ravi, sharePaise: 600_00 },
        { memberId: g.you, sharePaise: 600_00 },
        { memberId: g.arjun, sharePaise: 0 },
      ],
    }).expect(201);

    let group = await detail(g.id);
    expect(group).toMatchObject({ totalSpentPaise: 4800_00, mySharePaise: 1500_00, myNetPaise: -300_00, settled: false });
    expect(group.balances).toEqual([
      { memberId: g.you, netPaise: -300_00 },
      { memberId: g.ravi, netPaise: -1500_00 },
      { memberId: g.priya, netPaise: 2700_00 },
      { memberId: g.arjun, netPaise: -900_00 },
    ]);
    expect(group.transfers).toEqual([
      { fromId: g.ravi, toId: g.priya, amountPaise: 1500_00 },
      { fromId: g.arjun, toId: g.priya, amountPaise: 900_00 },
      { fromId: g.you, toId: g.priya, amountPaise: 300_00 },
    ]);
    const list = await http().get('/v1/groups').set(bearer(asha)).expect(200);
    expect(list.body.items[0]).toMatchObject({ id: g.id, myNetPaise: -300_00 });

    for (const t of group.transfers) {
      await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send({ ...t, day: today }).expect(201);
    }
    group = await detail(g.id);
    expect(group).toMatchObject({ settled: true, transfers: [], myNetPaise: 0 });
  });

  it('gives leftover paise to the first members in member order', async () => {
    const g = await goaTrip();
    const res = await expense(g.id, { description: 'Snacks', amountPaise: 100_00, day: today, paidById: g.you, splitMode: 'equal', memberIds: [g.priya, g.ravi, g.you] }).expect(201);
    expect(res.body.shares).toEqual([
      { memberId: g.you, sharePaise: 3334 },
      { memberId: g.ravi, sharePaise: 3333 },
      { memberId: g.priya, sharePaise: 3333 },
    ]);
  });

  it('turns away splits that do not add up, unknown members, future days and bad payments', async () => {
    const g = await goaTrip();
    const base = { description: 'Hotel', amountPaise: 1800_00, day: today, paidById: g.priya };
    const mismatch = await expense(g.id, {
      ...base,
      splitMode: 'exact',
      shares: [
        { memberId: g.you, sharePaise: 600_00 },
        { memberId: g.ravi, sharePaise: 600_00 },
        { memberId: g.priya, sharePaise: 480_00 },
      ],
    }).expect(400);
    expect(mismatch.body.error.code).toBe('GROUP_SPLIT_MISMATCH');

    const other = await goaTrip(ravi);
    const stranger = await expense(g.id, { ...base, splitMode: 'equal', memberIds: [g.you, other.you] }).expect(400);
    expect(stranger.body.error.code).toBe('GROUP_UNKNOWN_MEMBER');
    const payer = await expense(g.id, { ...base, paidById: other.priya, splitMode: 'equal', memberIds: [g.you] }).expect(400);
    expect(payer.body.error.code).toBe('GROUP_UNKNOWN_MEMBER');

    const future = await expense(g.id, { ...base, day: '2026-11-22', splitMode: 'equal', memberIds: [g.you] }).expect(400);
    expect(future.body.error.code).toBe('VALIDATION_FAILED');
    await expense(g.id, { ...base, splitMode: 'equal', memberIds: [] }).expect(400);
    await expense(g.id, { ...base, amountPaise: 0, splitMode: 'equal', memberIds: [g.you] }).expect(400);
    await expense(g.id, { ...base, amountPaise: 12.5, splitMode: 'equal', memberIds: [g.you] }).expect(400);

    const same = await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send({ fromId: g.you, toId: g.you, amountPaise: 100, day: today }).expect(400);
    expect(same.body.error.code).toBe('GROUP_PAYMENT_SAME_MEMBER');
  });

  it('adds, renames and removes members, but not one in use, nor "You"', async () => {
    const g = await goaTrip();
    const added = await http().post(`/v1/groups/${g.id}/members`).set(bearer(asha)).send({ name: 'Meera' }).expect(201);
    const dup = await http().post(`/v1/groups/${g.id}/members`).set(bearer(asha)).send({ name: ' ravi ' }).expect(409);
    expect(dup.body.error.code).toBe('GROUP_MEMBER_DUPLICATE');
    await http().patch(`/v1/groups/${g.id}/members/${added.body.id}`).set(bearer(asha)).send({ name: 'Meera S' }).expect(200);
    await http().patch(`/v1/groups/${g.id}/members/${added.body.id}`).set(bearer(asha)).send({ name: 'Priya' }).expect(409);

    await expense(g.id, { description: 'Lunch', amountPaise: 500_00, day: today, paidById: g.you, splitMode: 'equal', memberIds: [g.you, g.ravi] }).expect(201);
    const inUse = await http().delete(`/v1/groups/${g.id}/members/${g.ravi}`).set(bearer(asha)).expect(409);
    expect(inUse.body.error.code).toBe('GROUP_MEMBER_IN_USE');
    const self = await http().delete(`/v1/groups/${g.id}/members/${g.you}`).set(bearer(asha)).expect(400);
    expect(self.body.error.code).toBe('GROUP_MEMBER_SELF');
    await http().delete(`/v1/groups/${g.id}/members/${added.body.id}`).set(bearer(asha)).expect(204);
    expect((await detail(g.id)).members).toHaveLength(4);
  });

  it('edits and deletes expenses, and lists activity newest first across pages', async () => {
    const g = await goaTrip();
    const created = [];
    for (const day of ['2026-11-18', '2026-11-19', '2026-11-20']) {
      created.push(
        (await expense(g.id, { description: `Day ${day}`, amountPaise: 300_00, day, paidById: g.you, splitMode: 'equal', memberIds: [g.you, g.ravi, g.priya] }).expect(201)).body,
      );
    }
    await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send({ fromId: g.ravi, toId: g.you, amountPaise: 100_00, day: '2026-11-19' }).expect(201);

    const page1 = await http().get(`/v1/groups/${g.id}/activity?limit=2`).set(bearer(asha)).expect(200);
    expect(page1.body.items.map((i: { day: string; kind: string }) => `${i.day} ${i.kind}`)).toEqual(['2026-11-20 expense', '2026-11-19 payment']);
    const page2 = await http().get(`/v1/groups/${g.id}/activity?limit=2&cursor=${page1.body.nextCursor}`).set(bearer(asha)).expect(200);
    expect(page2.body.items.map((i: { day: string; kind: string }) => `${i.day} ${i.kind}`)).toEqual(['2026-11-19 expense', '2026-11-18 expense']);
    expect(page2.body.nextCursor).toBeNull();

    const edited = await http()
      .put(`/v1/groups/${g.id}/expenses/${created[0].id}`)
      .set(bearer(asha))
      .send({ description: 'Breakfast', amountPaise: 200_00, day: '2026-11-18', paidById: g.ravi, splitMode: 'equal', memberIds: [g.you, g.ravi] })
      .expect(200);
    expect(edited.body).toMatchObject({ description: 'Breakfast', paidById: g.ravi, shares: [{ memberId: g.you, sharePaise: 100_00 }, { memberId: g.ravi, sharePaise: 100_00 }] });
    await http().delete(`/v1/groups/${g.id}/expenses/${created[1].id}`).set(bearer(asha)).expect(204);
    await http().delete(`/v1/groups/${g.id}/expenses/${created[1].id}`).set(bearer(asha)).expect(404);
    expect((await detail(g.id)).totalSpentPaise).toBe(500_00);
  });

  it('archives, restores and deletes a group with expenses and payments', async () => {
    const g = await goaTrip();
    await expense(g.id, { description: 'Lunch', amountPaise: 500_00, day: today, paidById: g.you, splitMode: 'equal', memberIds: [g.you, g.ravi] }).expect(201);
    await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send({ fromId: g.ravi, toId: g.you, amountPaise: 250_00, day: today }).expect(201);

    await http().patch(`/v1/groups/${g.id}`).set(bearer(asha)).send({ archived: true }).expect(200);
    expect((await http().get('/v1/groups').set(bearer(asha)).expect(200)).body.items).toHaveLength(0);
    expect((await http().get('/v1/groups?archived=true').set(bearer(asha)).expect(200)).body.items).toHaveLength(1);
    await http().patch(`/v1/groups/${g.id}`).set(bearer(asha)).send({ archived: false, name: 'Goa 2026' }).expect(200);

    await http().delete(`/v1/groups/${g.id}`).set(bearer(asha)).expect(204);
    await http().get(`/v1/groups/${g.id}`).set(bearer(asha)).expect(404);
    const prisma = app.get(PrismaService);
    expect(await prisma.groupMember.count()).toBe(0);
    expect(await prisma.groupPayment.count()).toBe(0);
  });

  it('allows 50 active groups', async () => {
    const prisma = app.get(PrismaService);
    await prisma.group.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ userId: asha.user.id, name: `Group ${i}` })) });
    const res = await http().post('/v1/groups').set(bearer(asha)).send({ name: 'One more' }).expect(409);
    expect(res.body.error.code).toBe('GROUP_LIMIT');
  });

  it("never shows or changes another user's group, member, expense or payment", async () => {
    const g = await goaTrip();
    const exp = (await expense(g.id, { description: 'Lunch', amountPaise: 500_00, day: today, paidById: g.you, splitMode: 'equal', memberIds: [g.you, g.ravi] }).expect(201)).body;
    const pay = (await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send({ fromId: g.ravi, toId: g.you, amountPaise: 100_00, day: today }).expect(201)).body;
    const as = (r: request.Test) => r.set(bearer(ravi));
    await as(http().get(`/v1/groups/${g.id}`)).expect(404);
    await as(http().get(`/v1/groups/${g.id}/activity`)).expect(404);
    await as(http().patch(`/v1/groups/${g.id}`)).send({ name: 'Mine' }).expect(404);
    await as(http().delete(`/v1/groups/${g.id}`)).expect(404);
    await as(http().post(`/v1/groups/${g.id}/members`)).send({ name: 'Eve' }).expect(404);
    await as(http().patch(`/v1/groups/${g.id}/members/${g.ravi}`)).send({ name: 'Eve' }).expect(404);
    await as(http().delete(`/v1/groups/${g.id}/members/${g.arjun}`)).expect(404);
    await as(http().put(`/v1/groups/${g.id}/expenses/${exp.id}`))
      .send({ description: 'x', amountPaise: 1, day: today, paidById: g.you, splitMode: 'equal', memberIds: [g.you] })
      .expect(404);
    await as(http().delete(`/v1/groups/${g.id}/expenses/${exp.id}`)).expect(404);
    await as(http().delete(`/v1/groups/${g.id}/payments/${pay.id}`)).expect(404);
    expect((await as(http().get('/v1/groups')).expect(200)).body.items).toEqual([]);

    // Ids from one of Ravi's own groups don't reach into Asha's either.
    const mine = await goaTrip(ravi);
    await as(http().delete(`/v1/groups/${mine.id}/expenses/${exp.id}`)).expect(404);
    await as(http().delete(`/v1/groups/${mine.id}/members/${g.arjun}`)).expect(404);
    expect((await detail(g.id)).totalSpentPaise).toBe(500_00);
  });

  it('deletes groups with the account', async () => {
    await goaTrip();
    await http().delete('/v1/me').set(bearer(asha)).expect(204);
    const prisma = app.get(PrismaService);
    expect(await prisma.group.count()).toBe(0);
    expect(await prisma.groupMember.count()).toBe(0);
  });
});
