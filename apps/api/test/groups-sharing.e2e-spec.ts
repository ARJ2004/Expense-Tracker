import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common';
import { GroupsService } from '../src/groups';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

interface Member {
  id: string;
  name: string;
  isSelf: boolean;
  joined: boolean;
  isOwner: boolean;
}

async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  return fn();
}

describe('group sharing', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  let priya: Session;
  const today = '2026-11-25';
  const http = () => request(app.getHttpServer());

  /** Asha's Goa trip with Ravi, Priya and Arjun as names, and its join code. */
  const goaTrip = async () => {
    const res = await http().post('/v1/groups').set(bearer(asha)).send({ name: 'Goa trip', emoji: '🏖️', myName: 'Asha', members: ['Ravi', 'Priya', 'Arjun'] }).expect(201);
    const by = Object.fromEntries((res.body.members as Member[]).map((m) => [m.name, m.id])) as Record<string, string>;
    const invite = await http().post(`/v1/groups/${res.body.id}/invite`).set(bearer(asha)).send({}).expect(201);
    return { id: res.body.id as string, code: invite.body.code as string, asha: by.Asha as string, ravi: by.Ravi as string, priya: by.Priya as string, arjun: by.Arjun as string };
  };
  const join = (s: Session, code: string, body: object = {}) => http().post(`/v1/invites/${code}/accept`).set(bearer(s)).send(body);
  const detail = async (s: Session, id: string) => (await http().get(`/v1/groups/${id}`).set(bearer(s)).expect(200)).body;
  const dinner = (g: Awaited<ReturnType<typeof goaTrip>>, extra: object = {}) => ({
    description: 'Dinner',
    amountPaise: 3600_00,
    day: today,
    paidById: g.priya,
    splitMode: 'equal',
    memberIds: [g.asha, g.ravi, g.priya, g.arjun],
    ...extra,
  });

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    app.get(GroupsService).today = () => today;
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
    priya = await signIn(app, 'priya@example.com', 'device-0003');
  });

  afterEach(async () => {
    await app.close();
  });

  it('shares a link; Ravi claims his name and sees the same group from his side', async () => {
    const g = await goaTrip();
    expect((await http().get(`/v1/groups/${g.id}/invite`).set(bearer(asha)).expect(200)).body).toMatchObject({ active: true, invite: { code: g.code } });
    const link = await http().post(`/v1/groups/${g.id}/invite`).set(bearer(asha)).send({}).expect(201);
    expect(link.body).toEqual({ code: g.code, displayCode: `${g.code.slice(0, 4)}-${g.code.slice(4)}`, url: `http://15.252.181.82/altus/j/${g.code}` });

    const preview = await http().get(`/v1/invites/${g.code.toLowerCase()}`).set(bearer(ravi)).expect(200);
    expect(preview.body).toMatchObject({ groupId: g.id, groupName: 'Goa trip', invitedBy: 'Asha', alreadyMember: false });
    expect(preview.body.members.map((m: Member) => [m.name, m.joined])).toEqual([
      ['Asha', true],
      ['Ravi', false],
      ['Priya', false],
      ['Arjun', false],
    ]);

    await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(asha)).send(dinner(g)).expect(201);
    const joined = await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    expect(joined.body).toMatchObject({ myMemberId: g.ravi, isOwner: false, myNetPaise: -900_00 });
    expect(joined.body.members.find((m: Member) => m.isSelf).name).toBe('Ravi');

    const fromAsha = await detail(asha, g.id);
    const fromRavi = await detail(ravi, g.id);
    expect(fromRavi.balances).toEqual(fromAsha.balances);
    expect(fromRavi.transfers).toEqual(fromAsha.transfers);
    expect(fromAsha.members.find((m: Member) => m.id === g.ravi)).toMatchObject({ joined: true, isSelf: false });
    expect((await http().get('/v1/groups').set(bearer(ravi)).expect(200)).body.items).toEqual([expect.objectContaining({ id: g.id, myNetPaise: -900_00 })]);

    // Joining again is harmless; the preview now says he's in.
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    expect((await http().get(`/v1/invites/${g.code}`).set(bearer(ravi)).expect(200)).body.alreadyMember).toBe(true);
    expect((await detail(asha, g.id)).members).toHaveLength(4);
  });

  it('lets one person claim a name when two try at once; the other joins under a new name', async () => {
    const g = await goaTrip();
    const results = await Promise.all([join(ravi, g.code, { memberId: g.ravi }), join(priya, g.code, { memberId: g.ravi })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser?.body.error.code).toBe('GROUP_MEMBER_ALREADY_LINKED');
    const other = results[0]?.status === 409 ? ravi : priya;
    const res = await join(other, g.code, { name: 'Ravi' }).expect(200);
    expect(res.body.members.find((m: Member) => m.isSelf).name).toBe('Ravi 2');
  });

  it('turns old links off: reset is owner only, and an old or unknown code never joins', async () => {
    const g = await goaTrip();
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    const forbidden = await http().post(`/v1/groups/${g.id}/invite`).set(bearer(ravi)).send({ reset: true }).expect(403);
    expect(forbidden.body.error.code).toBe('GROUP_OWNER_ONLY');
    // Any member can fetch and share the current link.
    expect((await http().post(`/v1/groups/${g.id}/invite`).set(bearer(ravi)).send({}).expect(201)).body.code).toBe(g.code);

    const fresh = await http().post(`/v1/groups/${g.id}/invite`).set(bearer(asha)).send({ reset: true }).expect(201);
    expect(fresh.body.code).not.toBe(g.code);
    const old = await join(priya, g.code, { memberId: g.priya }).expect(404);
    expect(old.body.error.code).toBe('INVITE_NOT_FOUND');
    await http().get(`/v1/public/invites/${g.code}`).expect(404);
    expect((await http().get(`/v1/public/invites/${fresh.body.code}`).expect(200)).body).toEqual({ groupName: 'Goa trip', emoji: '🏖️', invitedBy: 'Asha' });

    await http().delete(`/v1/groups/${g.id}/invite`).set(bearer(ravi)).expect(403);
    await http().delete(`/v1/groups/${g.id}/invite`).set(bearer(asha)).expect(204);
    await join(priya, fresh.body.code).expect(404);
    expect((await http().get(`/v1/groups/${g.id}/invite`).set(bearer(asha)).expect(200)).body).toEqual({ active: false });
    await http().get('/v1/invites/NOTACODE00').set(bearer(priya)).expect(404);
  });

  it('refuses the second of two edits made from the same version, and stale deletes', async () => {
    const g = await goaTrip();
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    const created = (await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(asha)).send(dinner(g)).expect(201)).body;
    expect(created.version).toBe(1);
    const [a, b] = await Promise.all([
      http().put(`/v1/groups/${g.id}/expenses/${created.id}`).set(bearer(asha)).send(dinner(g, { amountPaise: 3200_00, version: 1 })),
      http().put(`/v1/groups/${g.id}/expenses/${created.id}`).set(bearer(ravi)).send(dinner(g, { description: 'Dinner + drinks', version: 1 })),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find((r) => r.status === 409)?.body.error.code).toBe('GROUP_EXPENSE_CHANGED');
    await http().delete(`/v1/groups/${g.id}/expenses/${created.id}?version=1`).set(bearer(ravi)).expect(409);
    await http().delete(`/v1/groups/${g.id}/expenses/${created.id}?version=2`).set(bearer(ravi)).expect(204);
  });

  it('adds an expense or payment once however often the same request is retried', async () => {
    const g = await goaTrip();
    const body = dinner(g, { clientRequestId: '0192f2a4-5b6c-7d8e-9f00-112233445566' });
    const results = await Promise.all([1, 2, 3].map(() => http().post(`/v1/groups/${g.id}/expenses`).set(bearer(asha)).send(body)));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    const pay = { fromId: g.ravi, toId: g.priya, amountPaise: 900_00, day: today, clientRequestId: '0192f2a4-5b6c-7d8e-9f00-665544332211' };
    await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send(pay).expect(201);
    await http().post(`/v1/groups/${g.id}/payments`).set(bearer(asha)).send(pay).expect(201);
    const activity = (await http().get(`/v1/groups/${g.id}/activity`).set(bearer(asha)).expect(200)).body.items;
    expect(activity.map((i: { kind: string }) => i.kind).sort()).toEqual(['expense', 'payment']);
  });

  it('lets everyone edit, but only the owner removes people, resets or deletes', async () => {
    const g = await goaTrip();
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    await join(priya, g.code, { memberId: g.priya }).expect(200);
    const exp = (await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(ravi)).send(dinner(g)).expect(201)).body;
    await http().put(`/v1/groups/${g.id}/expenses/${exp.id}`).set(bearer(priya)).send(dinner(g, { amountPaise: 3000_00, version: 1 })).expect(200);
    await http().patch(`/v1/groups/${g.id}`).set(bearer(ravi)).send({ name: 'Goa 2026' }).expect(200);
    await http().post(`/v1/groups/${g.id}/members`).set(bearer(priya)).send({ name: 'Meera' }).expect(201);

    for (const req of [
      () => http().delete(`/v1/groups/${g.id}`).set(bearer(ravi)),
      () => http().delete(`/v1/groups/${g.id}/members/${g.priya}/link`).set(bearer(ravi)),
      () => http().post(`/v1/groups/${g.id}/owner`).set(bearer(ravi)).send({ memberId: g.ravi }),
    ]) {
      const res = await req().expect(403);
      expect(res.body.error.code).toBe('GROUP_OWNER_ONLY');
    }
    // A joined person can't be deleted as a name; the owner removes them instead.
    expect((await http().delete(`/v1/groups/${g.id}/members/${g.priya}`).set(bearer(ravi)).expect(409)).body.error.code).toBe('GROUP_MEMBER_JOINED');

    const before = (await detail(asha, g.id)).balances;
    const after = await http().delete(`/v1/groups/${g.id}/members/${g.priya}/link`).set(bearer(asha)).expect(200);
    expect(after.body.members.find((m: Member) => m.id === g.priya)).toMatchObject({ name: 'Priya', joined: false });
    expect(after.body.balances).toEqual(before);
    await http().get(`/v1/groups/${g.id}`).set(bearer(priya)).expect(404);
  });

  it('leaving keeps the name and balances; the owner hands over before leaving', async () => {
    const g = await goaTrip();
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(asha)).send(dinner(g)).expect(201);
    expect((await http().post(`/v1/groups/${g.id}/leave`).set(bearer(asha)).expect(409)).body.error.code).toBe('GROUP_OWNER_MUST_TRANSFER');
    const notJoined = await http().post(`/v1/groups/${g.id}/owner`).set(bearer(asha)).send({ memberId: g.arjun }).expect(400);
    expect(notJoined.body.error.code).toBe('GROUP_MEMBER_NOT_JOINED');

    const handed = await http().post(`/v1/groups/${g.id}/owner`).set(bearer(asha)).send({ memberId: g.ravi }).expect(201);
    expect(handed.body.isOwner).toBe(false);
    const balances = (await detail(ravi, g.id)).balances;
    await http().post(`/v1/groups/${g.id}/leave`).set(bearer(asha)).expect(204);
    await http().get(`/v1/groups/${g.id}`).set(bearer(asha)).expect(404);
    const now = await detail(ravi, g.id);
    expect(now.isOwner).toBe(true);
    expect(now.balances).toEqual(balances);
    expect(now.members.find((m: Member) => m.id === g.asha)).toMatchObject({ name: 'Asha', joined: false });
  });

  it('records who did what, newest first, from the viewer’s side', async () => {
    const g = await goaTrip();
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    const exp = (await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(ravi)).send(dinner(g)).expect(201)).body;
    await http().put(`/v1/groups/${g.id}/expenses/${exp.id}`).set(bearer(asha)).send(dinner(g, { amountPaise: 3200_00 })).expect(200);
    const history = (await http().get(`/v1/groups/${g.id}/history`).set(bearer(asha)).expect(200)).body.items;
    expect(history.slice(0, 3).map((h: { actorName: string; actorIsSelf: boolean; text: string }) => [h.actorName, h.actorIsSelf, h.text])).toEqual([
      ['Asha', true, 'changed Dinner from ₹3,600 to ₹3,200'],
      ['Ravi', false, 'added Dinner · ₹3,600'],
      ['Ravi', false, 'joined as Ravi'],
    ]);
    await http().get(`/v1/groups/${g.id}/history`).set(bearer(priya)).expect(404);
  });

  it('bumps the group’s rev on every write', async () => {
    const g = await goaTrip();
    const r1 = (await detail(asha, g.id)).rev;
    await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(asha)).send(dinner(g)).expect(201);
    expect((await detail(asha, g.id)).rev).toBeGreaterThan(r1);
  });

  it('tells the people involved: the owner when someone joins, sharers about an expense', async () => {
    const g = await goaTrip();
    await join(ravi, g.code, { memberId: g.ravi }).expect(200);
    const inbox = (s: Session) => async () => (await http().get('/v1/notifications').set(bearer(s)).expect(200)).body as { items: { title: string }[] };
    const ashaBox = await eventually(inbox(asha), (b) => b.items.length > 0);
    expect(ashaBox.items[0]?.title).toBe('Ravi joined Goa trip');
    await http().post(`/v1/groups/${g.id}/expenses`).set(bearer(asha)).send(dinner(g)).expect(201);
    const raviBox = await eventually(inbox(ravi), (b) => b.items.length > 0);
    expect(raviBox.items[0]?.title).toBe('Asha added Dinner · ₹3,600');
  });

  it('on account deletion hands a shared group on, deletes one nobody joined, and unlinks members', async () => {
    const shared = await goaTrip();
    await join(ravi, shared.code, { memberId: shared.ravi }).expect(200);
    await http().post(`/v1/groups/${shared.id}/expenses`).set(bearer(asha)).send(dinner(shared)).expect(201);
    const alone = (await http().post('/v1/groups').set(bearer(asha)).send({ name: 'Solo', myName: 'Asha' }).expect(201)).body;
    const ravisGroup = (await http().post('/v1/groups').set(bearer(ravi)).send({ name: 'Flat', myName: 'Ravi' }).expect(201)).body;
    const code = (await http().post(`/v1/groups/${ravisGroup.id}/invite`).set(bearer(ravi)).send({}).expect(201)).body.code;
    await join(asha, code, { name: 'Asha' }).expect(200);

    const balances = (await detail(ravi, shared.id)).balances;
    await http().delete('/v1/me').set(bearer(asha)).expect(204);
    const prisma = app.get(PrismaService);
    expect(await prisma.group.count({ where: { id: alone.id } })).toBe(0);
    const now = await detail(ravi, shared.id);
    expect(now.isOwner).toBe(true);
    expect(now.balances).toEqual(balances);
    expect(now.members.find((m: Member) => m.id === shared.asha)).toMatchObject({ name: 'Asha', joined: false });
    // Asha never used her name in Ravi's flat, so it's gone; the flat stays.
    expect((await detail(ravi, ravisGroup.id)).members.map((m: Member) => m.name)).toEqual(['Ravi']);
  });

  it('serves a join page for the link, and a "doesn’t work" page for a bad one', async () => {
    const g = await goaTrip();
    const page = await http().get(`/j/${g.code}`).expect(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.text).toContain('Join Goa trip on Altus');
    expect(page.text).toContain(`intent://j/${g.code}#Intent;scheme=altus;package=in.altus.app`);
    expect(page.text).toContain(`${g.code.slice(0, 4)}-${g.code.slice(4)}`);
    expect(page.text).not.toContain('Ravi');
    const bad = await http().get('/j/NOPE<script>').expect(200);
    expect(bad.text).toContain('This link doesn’t work any more');
    expect(bad.text).not.toContain('<script>alert');
  });
});
