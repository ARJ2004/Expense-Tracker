import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { GroupExpense, GroupExpenseShare, GroupMember, GroupPayment, Prisma } from '@prisma/client';
import { GROUP_LIMITS, groupEventText, istDateKey, memberNameKey, simplifyDebts, type GroupEventSummary, type GroupEventType } from '@et/domain';
import { AppError, PrismaService } from '../common';
import { SPLIT_STRATEGIES } from './domain/split-strategies';
import type {
  CreateGroupDto,
  GroupActivityDto,
  GroupActivityListDto,
  GroupDetailDto,
  GroupHistoryListDto,
  GroupMemberDto,
  GroupSummaryDto,
  SaveExpenseDto,
  SavePaymentDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { GroupStore, notFound, type Db, type LoadedGroup } from './group-store';
import {
  GROUP_DELETED,
  GROUP_EXPENSE_CREATED,
  GROUP_PAYMENT_CREATED,
  GROUP_SETTLED,
  type GroupDeletedEvent,
  type GroupExpenseCreatedEvent,
  type GroupPaymentCreatedEvent,
  type GroupSettledEvent,
} from './groups.events';

/** Per member: what they paid, their shares, payments they made and payments they got. */
interface Totals {
  paid: number;
  share: number;
  sent: number;
  received: number;
}

const DEFAULT_MY_NAME = 'Me';
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const asDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Owns groups and their members, expenses, payments, invites and history. A group is shared by
 * every member linked to a user; each of them sees the same rows, and balances are worked out from
 * those rows on every read, for whoever is asking, so nobody's numbers can drift. Every write goes
 * through GroupStore (row lock, rev, history). Group expenses are not ledger transactions: nothing
 * here touches transactions or ingest.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: GroupStore,
    private readonly events: EventEmitter2,
  ) {}

  /** Today in IST; a property so tests can move the clock. */
  today = (): string => istDateKey(new Date());

  // ---- Groups ----

  async list(userId: string, archived = false): Promise<GroupSummaryDto[]> {
    const groups = await this.prisma.group.findMany({
      where: { members: { some: { userId, archivedAt: archived ? { not: null } : null } } },
      include: { members: { select: { id: true, userId: true, archivedAt: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    const mine = groups.map((g) => g.members.find((m) => m.userId === userId));
    const totals = await this.totals(mine.flatMap((m) => (m ? [m.id] : [])));
    return groups.map((g, i) => {
      const me = mine[i];
      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        memberCount: g.members.length,
        myNetPaise: me ? net(totals.get(me.id)) : 0,
        archived: me?.archivedAt != null,
        rev: Number(g.rev),
      };
    });
  }

  async get(userId: string, id: string): Promise<GroupDetailDto> {
    const { group } = await this.store.read(userId, id);
    return this.detail(group, userId);
  }

  async create(userId: string, dto: CreateGroupDto): Promise<GroupDetailDto> {
    const names = [dto.myName ?? DEFAULT_MY_NAME, ...(dto.members ?? [])];
    const keys = names.map(memberNameKey);
    if (new Set(keys).size !== keys.length) throw duplicateMember();
    await this.assertRoomForAnotherGroup(userId);
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          ownerId: userId,
          name: dto.name,
          emoji: dto.emoji ?? null,
          members: {
            create: names.map((name, position) => ({
              name,
              nameKey: memberNameKey(name),
              position,
              ...(position === 0 ? { userId, joinedAt: new Date() } : {}),
            })),
          },
        },
        include: { members: { orderBy: { position: 'asc' } } },
      });
      const me = created.members[0];
      await tx.groupEvent.create({ data: { groupId: created.id, actorMemberId: me?.id ?? null, type: 'group.created', summary: { name: dto.name } } });
      return created;
    });
    return this.detail(group, userId);
  }

  /** Name and icon change for everyone; `archived` only hides the group from the caller's list. */
  async update(userId: string, id: string, dto: UpdateGroupDto): Promise<GroupDetailDto> {
    if (dto.archived === false) {
      const { me } = await this.store.read(userId, id);
      if (me.archivedAt) await this.assertRoomForAnotherGroup(userId);
    }
    await this.store.write(userId, id, async (ctx) => {
      const me = ctx.me as GroupMember;
      if (dto.name !== undefined && dto.name !== ctx.group.name) ctx.record('group.renamed', { from: ctx.group.name, to: dto.name });
      if (dto.name !== undefined || dto.emoji !== undefined) {
        await ctx.tx.group.update({
          where: { id },
          data: { ...(dto.name !== undefined ? { name: dto.name } : {}), ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}) },
        });
      }
      if (dto.archived !== undefined) {
        await ctx.tx.groupMember.update({ where: { id: me.id }, data: { archivedAt: dto.archived ? (me.archivedAt ?? new Date()) : null } });
      }
    });
    return this.get(userId, id);
  }

  /** Owner only. Removes the group, with everything in it, for every member. */
  async remove(userId: string, id: string): Promise<void> {
    await this.store.write(userId, id, async (ctx) => {
      this.store.requireOwner(ctx, userId);
      const others = ctx.group.members.flatMap((m) => (m.userId && m.userId !== userId ? [m.userId] : []));
      await ctx.tx.group.delete({ where: { id } });
      ctx.after(() => this.events.emit(GROUP_DELETED, { groupId: id, groupName: ctx.group.name, recipientUserIds: others } satisfies GroupDeletedEvent));
    });
  }

  /** Owner only: someone else who joined becomes the owner. */
  async transferOwner(userId: string, id: string, memberId: string): Promise<GroupDetailDto> {
    await this.store.write(userId, id, async (ctx) => {
      this.store.requireOwner(ctx, userId);
      const target = memberOf(ctx.group, memberId);
      if (!target.userId) throw new AppError('GROUP_MEMBER_NOT_JOINED', `${target.name} hasn’t joined yet`);
      if (target.userId === userId) return;
      await ctx.tx.group.update({ where: { id }, data: { ownerId: target.userId } });
      ctx.record('owner.changed', { name: target.name });
    });
    return this.get(userId, id);
  }

  /**
   * The caller leaves. Their name stays with its history (balances don't change) unless it was
   * never used. The owner hands ownership on first.
   */
  async leave(userId: string, id: string): Promise<void> {
    await this.store.write(userId, id, async (ctx) => {
      if (ctx.group.ownerId === userId) {
        throw new AppError('GROUP_OWNER_MUST_TRANSFER', 'Make someone else the owner first, or delete the group', HttpStatus.CONFLICT);
      }
      ctx.record('member.left', { name: (ctx.me as GroupMember).name });
      await this.unlink(ctx.tx, ctx.me as GroupMember);
    });
  }

  /** Owner only: removes someone who joined. Same as them leaving. */
  async removeJoined(userId: string, id: string, memberId: string): Promise<GroupDetailDto> {
    await this.store.write(userId, id, async (ctx) => {
      this.store.requireOwner(ctx, userId);
      const target = memberOf(ctx.group, memberId);
      if (target.userId === userId) throw selfMember('You can’t remove yourself. Delete the group or make someone else the owner.');
      if (!target.userId) throw new AppError('GROUP_MEMBER_NOT_JOINED', `${target.name} hasn’t joined`);
      ctx.record('member.unlinked', { name: target.name });
      await this.unlink(ctx.tx, target);
    });
    return this.get(userId, id);
  }

  // ---- Members (names) ----

  async addMember(userId: string, groupId: string, name: string): Promise<GroupMemberDto> {
    return this.store.write(userId, groupId, async (ctx) => {
      if (ctx.group.members.length >= GROUP_LIMITS.maxMembers) throw memberLimit();
      if (ctx.group.members.some((m) => m.nameKey === memberNameKey(name))) throw duplicateMember();
      const position = Math.max(...ctx.group.members.map((m) => m.position)) + 1;
      const member = await ctx.tx.groupMember.create({ data: { groupId, name, nameKey: memberNameKey(name), position } });
      ctx.record('member.added', { name });
      return toMemberDto(member, userId, ctx.group.ownerId);
    });
  }

  async renameMember(userId: string, groupId: string, memberId: string, name: string): Promise<GroupMemberDto> {
    return this.store.write(userId, groupId, async (ctx) => {
      const member = memberOf(ctx.group, memberId);
      if (ctx.group.members.some((m) => m.id !== memberId && m.nameKey === memberNameKey(name))) throw duplicateMember();
      const updated = await ctx.tx.groupMember.update({ where: { id: memberId }, data: { name, nameKey: memberNameKey(name) } });
      if (member.name !== name) ctx.record('member.renamed', { from: member.name, to: name });
      return toMemberDto(updated, userId, ctx.group.ownerId);
    });
  }

  /** Deletes a name nobody joined as and that is in no expense or payment. */
  async removeMember(userId: string, groupId: string, memberId: string): Promise<void> {
    await this.store.write(userId, groupId, async (ctx) => {
      const member = memberOf(ctx.group, memberId);
      if (member.userId === userId) throw selfMember('You are part of this group. Leave it instead.');
      if (member.userId) throw new AppError('GROUP_MEMBER_JOINED', `${member.name} joined this group. The owner can remove them.`, HttpStatus.CONFLICT);
      if (await inUse(ctx.tx, memberId)) {
        throw new AppError('GROUP_MEMBER_IN_USE', `${member.name} is part of an expense or payment. Remove them from those first.`, HttpStatus.CONFLICT);
      }
      await ctx.tx.groupMember.delete({ where: { id: memberId } });
      ctx.record('member.removed', { name: member.name });
    });
  }

  // ---- Expenses and payments ----

  async activity(userId: string, groupId: string, cursor: string | undefined, limit: number): Promise<GroupActivityListDto> {
    await this.store.read(userId, groupId);
    const after = cursor ? decodeCursor(cursor) : null;
    if (cursor && !after) throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
    const where = after ? { OR: [{ day: { lt: asDate(after.day) } }, { day: asDate(after.day), id: { lt: after.id } }] } : {};
    const order = [{ day: 'desc' }, { id: 'desc' }] as const satisfies Prisma.GroupExpenseOrderByWithRelationInput[];
    const [expenses, payments] = await Promise.all([
      this.prisma.groupExpense.findMany({ where: { groupId, ...where }, include: { shares: true }, orderBy: [...order], take: limit + 1 }),
      this.prisma.groupPayment.findMany({ where: { groupId, ...where }, orderBy: [...order], take: limit + 1 }),
    ]);
    const rows = [...expenses.map(toExpenseDto), ...payments.map(toPaymentDto)].sort((a, b) =>
      a.day === b.day ? (a.id < b.id ? 1 : -1) : a.day < b.day ? 1 : -1,
    );
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { items: page, nextCursor: rows.length > limit && last ? encodeCursor({ day: last.day, id: last.id }) : null };
  }

  /** Newest first: who did what, with the words ready to show. */
  async history(userId: string, groupId: string, cursor: string | undefined, limit: number): Promise<GroupHistoryListDto> {
    const { group } = await this.store.read(userId, groupId);
    const after = cursor ? decodeCursor(cursor) : null;
    if (cursor && !after) throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
    const rows = await this.prisma.groupEvent.findMany({
      where: { groupId, ...(after ? { id: { lt: after.id } } : {}) },
      orderBy: [{ id: 'desc' }],
      take: limit + 1,
    });
    const members = new Map(group.members.map((m) => [m.id, m]));
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((e) => {
        const actor = e.actorMemberId ? members.get(e.actorMemberId) : undefined;
        return {
          id: e.id,
          type: e.type,
          actorName: actor?.name ?? null,
          actorIsSelf: actor?.userId === userId,
          text: groupEventText(e.type as GroupEventType, e.summary as GroupEventSummary),
          createdAt: e.createdAt.toISOString(),
        };
      }),
      nextCursor: rows.length > limit && last ? encodeCursor({ day: asDay(last.createdAt), id: last.id }) : null,
    };
  }

  async createExpense(userId: string, groupId: string, dto: SaveExpenseDto): Promise<GroupActivityDto> {
    return this.store.write(userId, groupId, async (ctx) => {
      if (dto.clientRequestId) {
        const seen = await ctx.tx.groupExpense.findFirst({ where: { groupId, clientRequestId: dto.clientRequestId }, include: { shares: true } });
        if (seen) return toExpenseDto(seen);
      }
      const shares = this.split(ctx.group, dto);
      const expense = await ctx.tx.groupExpense.create({
        data: {
          groupId,
          description: dto.description,
          amountPaise: BigInt(dto.amountPaise),
          paidById: dto.paidById,
          splitMode: dto.splitMode,
          day: asDate(dto.day),
          clientRequestId: dto.clientRequestId ?? null,
          shares: { create: shares.map((s) => ({ memberId: s.memberId, sharePaise: BigInt(s.sharePaise) })) },
        },
        include: { shares: true },
      });
      ctx.record('expense.created', { description: dto.description, amountPaise: dto.amountPaise });
      const me = ctx.me as GroupMember;
      const recipients = shares.flatMap((s) => {
        const m = ctx.group.members.find((x) => x.id === s.memberId);
        return m?.userId && m.userId !== userId && s.sharePaise > 0 ? [{ userId: m.userId, sharePaise: s.sharePaise }] : [];
      });
      ctx.after(() =>
        this.events.emit(GROUP_EXPENSE_CREATED, {
          groupId,
          groupName: ctx.group.name,
          expenseId: expense.id,
          actorUserId: userId,
          actorName: me.name,
          description: dto.description,
          amountPaise: dto.amountPaise,
          recipients,
        } satisfies GroupExpenseCreatedEvent),
      );
      return toExpenseDto(expense);
    });
  }

  /** Replaces an expense. With `version`, refuses to overwrite someone else's newer save. */
  async updateExpense(userId: string, groupId: string, expenseId: string, dto: SaveExpenseDto): Promise<GroupActivityDto> {
    return this.store.write(userId, groupId, async (ctx) => {
      const found = await ctx.tx.groupExpense.findFirst({ where: { id: expenseId, groupId } });
      if (!found) throw notFound('Expense');
      assertVersion(found.version, dto.version);
      const shares = this.split(ctx.group, dto);
      await ctx.tx.groupExpenseShare.deleteMany({ where: { expenseId } });
      const expense = await ctx.tx.groupExpense.update({
        where: { id: expenseId },
        data: {
          description: dto.description,
          amountPaise: BigInt(dto.amountPaise),
          paidById: dto.paidById,
          splitMode: dto.splitMode,
          day: asDate(dto.day),
          version: { increment: 1 },
          shares: { create: shares.map((s) => ({ memberId: s.memberId, sharePaise: BigInt(s.sharePaise) })) },
        },
        include: { shares: true },
      });
      ctx.record('expense.updated', {
        description: dto.description,
        amountPaise: dto.amountPaise,
        before: { description: found.description, amountPaise: Number(found.amountPaise) },
      });
      return toExpenseDto(expense);
    });
  }

  async removeExpense(userId: string, groupId: string, expenseId: string, version?: number): Promise<void> {
    await this.store.write(userId, groupId, async (ctx) => {
      const found = await ctx.tx.groupExpense.findFirst({ where: { id: expenseId, groupId } });
      if (!found) throw notFound('Expense');
      assertVersion(found.version, version);
      await ctx.tx.groupExpense.delete({ where: { id: expenseId } });
      ctx.record('expense.deleted', { description: found.description, amountPaise: Number(found.amountPaise) });
    });
  }

  async createPayment(userId: string, groupId: string, dto: SavePaymentDto): Promise<GroupActivityDto> {
    const result = await this.store.write(userId, groupId, async (ctx) => {
      if (dto.clientRequestId) {
        const seen = await ctx.tx.groupPayment.findFirst({ where: { groupId, clientRequestId: dto.clientRequestId } });
        if (seen) return { payment: toPaymentDto(seen), group: ctx.group };
      }
      this.assertDay(dto.day);
      if (dto.fromId === dto.toId) throw new AppError('GROUP_PAYMENT_SAME_MEMBER', 'Pick two different members');
      const from = memberOf(ctx.group, dto.fromId, 'GROUP_UNKNOWN_MEMBER');
      const to = memberOf(ctx.group, dto.toId, 'GROUP_UNKNOWN_MEMBER');
      const payment = await ctx.tx.groupPayment.create({
        data: { groupId, fromId: dto.fromId, toId: dto.toId, amountPaise: BigInt(dto.amountPaise), day: asDate(dto.day), clientRequestId: dto.clientRequestId ?? null },
      });
      ctx.record('payment.created', { from: from.name, to: to.name, amountPaise: dto.amountPaise });
      ctx.after(() =>
        this.events.emit(GROUP_PAYMENT_CREATED, {
          groupId,
          groupName: ctx.group.name,
          paymentId: payment.id,
          actorUserId: userId,
          fromName: from.name,
          amountPaise: dto.amountPaise,
          recipientUserId: to.userId && to.userId !== userId ? to.userId : null,
        } satisfies GroupPaymentCreatedEvent),
      );
      return { payment: toPaymentDto(payment), group: ctx.group };
    });
    const totals = await this.totals(result.group.members.map((m) => m.id));
    if ([...totals.values()].every((t) => net(t) === 0)) {
      this.events.emit(GROUP_SETTLED, { groupId, actorUserId: userId } satisfies GroupSettledEvent);
    }
    return result.payment;
  }

  async removePayment(userId: string, groupId: string, paymentId: string): Promise<void> {
    await this.store.write(userId, groupId, async (ctx) => {
      const found = await ctx.tx.groupPayment.findFirst({ where: { id: paymentId, groupId } });
      if (!found) throw notFound('Payment');
      await ctx.tx.groupPayment.delete({ where: { id: paymentId } });
      const name = (id: string) => ctx.group.members.find((m) => m.id === id)?.name ?? 'Someone';
      ctx.record('payment.deleted', { from: name(found.fromId), to: name(found.toId), amountPaise: Number(found.amountPaise) });
    });
  }

  // ---- Accounts ----

  /**
   * Account deletion (called by the users purge, in its transaction). Groups the user owns pass to
   * whoever joined earliest; a group nobody else joined goes. Every other group keeps the user's
   * name and history, unlinked. Another person's shared group is never deleted.
   */
  async purgeUser(userId: string, tx: Db): Promise<void> {
    const owned = await tx.group.findMany({ where: { ownerId: userId }, include: { members: { orderBy: { joinedAt: 'asc' } } } });
    for (const g of owned) {
      const heir = g.members.find((m) => m.userId && m.userId !== userId);
      const mine = g.members.find((m) => m.userId === userId);
      if (!heir?.userId) {
        await tx.group.delete({ where: { id: g.id } });
        continue;
      }
      await tx.group.update({ where: { id: g.id }, data: { ownerId: heir.userId, rev: { increment: 1 } } });
      await tx.groupEvent.create({ data: { groupId: g.id, actorMemberId: mine?.id ?? null, type: 'owner.changed', summary: { name: heir.name } } });
    }
    const memberships = await tx.groupMember.findMany({ where: { userId } });
    for (const m of memberships) {
      await tx.groupEvent.create({ data: { groupId: m.groupId, actorMemberId: m.id, type: 'member.left', summary: { name: m.name } } });
      await tx.group.update({ where: { id: m.groupId }, data: { rev: { increment: 1 } } });
      await this.unlink(tx, m);
    }
  }

  // ---- Internals ----

  /** Unlinks a member; a name that was never used goes entirely. */
  private async unlink(tx: Db, member: GroupMember): Promise<void> {
    if (await inUse(tx, member.id)) {
      await tx.groupMember.update({ where: { id: member.id }, data: { userId: null, joinedAt: null, archivedAt: null } });
    } else {
      await tx.groupMember.delete({ where: { id: member.id } });
    }
  }

  private async assertRoomForAnotherGroup(userId: string): Promise<void> {
    const active = await this.prisma.groupMember.count({ where: { userId, archivedAt: null } });
    if (active >= GROUP_LIMITS.maxActiveGroups) throw groupLimit();
  }

  private assertDay(day: string): void {
    if (day > this.today()) throw new AppError('VALIDATION_FAILED', 'The date can’t be in the future');
  }

  private split(group: LoadedGroup, dto: SaveExpenseDto) {
    this.assertDay(dto.day);
    memberOf(group, dto.paidById, 'GROUP_UNKNOWN_MEMBER');
    const strategy = SPLIT_STRATEGIES.find((s) => s.mode === dto.splitMode);
    if (!strategy) throw new AppError('VALIDATION_FAILED', 'Unknown split');
    const result = strategy.compute({ amountPaise: dto.amountPaise, memberOrder: group.members.map((m) => m.id), memberIds: dto.memberIds, shares: dto.shares });
    if (!result.ok) throw new AppError(result.code, result.message);
    return result.shares;
  }

  /** Paid, shared, sent and received per member, in four grouped queries. */
  private async totals(memberIds: string[]): Promise<Map<string, Totals>> {
    const totals = new Map<string, Totals>(memberIds.map((id) => [id, { paid: 0, share: 0, sent: 0, received: 0 }]));
    if (memberIds.length === 0) return totals;
    const [paid, shares, sent, received] = await Promise.all([
      this.prisma.groupExpense.groupBy({ by: ['paidById'], where: { paidById: { in: memberIds } }, _sum: { amountPaise: true } }),
      this.prisma.groupExpenseShare.groupBy({ by: ['memberId'], where: { memberId: { in: memberIds } }, _sum: { sharePaise: true } }),
      this.prisma.groupPayment.groupBy({ by: ['fromId'], where: { fromId: { in: memberIds } }, _sum: { amountPaise: true } }),
      this.prisma.groupPayment.groupBy({ by: ['toId'], where: { toId: { in: memberIds } }, _sum: { amountPaise: true } }),
    ]);
    const add = (id: string, key: keyof Totals, value: bigint | null) => {
      const t = totals.get(id);
      if (t) t[key] += Number(value ?? 0n);
    };
    paid.forEach((r) => add(r.paidById, 'paid', r._sum.amountPaise));
    shares.forEach((r) => add(r.memberId, 'share', r._sum.sharePaise));
    sent.forEach((r) => add(r.fromId, 'sent', r._sum.amountPaise));
    received.forEach((r) => add(r.toId, 'received', r._sum.amountPaise));
    return totals;
  }

  /** The group as `viewerId` sees it: their member is "You" and their balance leads. */
  async detail(group: LoadedGroup, viewerId: string): Promise<GroupDetailDto> {
    const ids = group.members.map((m) => m.id);
    const totals = await this.totals(ids);
    const balances = new Map(ids.map((id) => [id, net(totals.get(id))]));
    const me = group.members.find((m) => m.userId === viewerId);
    const myTotals = me ? totals.get(me.id) : undefined;
    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      archived: me?.archivedAt != null,
      rev: Number(group.rev),
      myMemberId: me?.id ?? '',
      isOwner: group.ownerId === viewerId,
      members: group.members.map((m) => toMemberDto(m, viewerId, group.ownerId)),
      balances: ids.map((memberId) => ({ memberId, netPaise: balances.get(memberId) ?? 0 })),
      transfers: simplifyDebts(balances),
      settled: [...balances.values()].every((v) => v === 0),
      totalSpentPaise: [...totals.values()].reduce((sum, t) => sum + t.paid, 0),
      mySharePaise: myTotals?.share ?? 0,
      myNetPaise: net(myTotals),
    };
  }
}

/** Positive: gets money back. Negative: owes. */
function net(t: Totals | undefined): number {
  return t ? t.paid - t.share + t.sent - t.received : 0;
}

async function inUse(tx: Db, memberId: string): Promise<boolean> {
  const [paid, shared, payments] = await Promise.all([
    tx.groupExpense.count({ where: { paidById: memberId } }),
    tx.groupExpenseShare.count({ where: { memberId } }),
    tx.groupPayment.count({ where: { OR: [{ fromId: memberId }, { toId: memberId }] } }),
  ]);
  return paid + shared + payments > 0;
}

function assertVersion(current: number, sent: number | undefined): void {
  if (sent !== undefined && sent !== current) {
    throw new AppError('GROUP_EXPENSE_CHANGED', 'Someone changed this expense just now. Check it and try again.', HttpStatus.CONFLICT);
  }
}

function memberOf(group: LoadedGroup, memberId: string, code = 'NOT_FOUND'): GroupMember {
  const member = group.members.find((m) => m.id === memberId);
  if (!member) {
    throw code === 'NOT_FOUND' ? notFound('Member') : new AppError(code, 'That member is not in this group');
  }
  return member;
}

export function toMemberDto(m: GroupMember, viewerId: string, ownerId: string): GroupMemberDto {
  return { id: m.id, name: m.name, isSelf: m.userId === viewerId, joined: m.userId !== null, isOwner: m.userId !== null && m.userId === ownerId };
}

function toExpenseDto(e: GroupExpense & { shares: GroupExpenseShare[] }): GroupActivityDto {
  return {
    kind: 'expense',
    id: e.id,
    day: asDay(e.day),
    amountPaise: Number(e.amountPaise),
    description: e.description,
    paidById: e.paidById,
    splitMode: e.splitMode,
    shares: e.shares.map((s) => ({ memberId: s.memberId, sharePaise: Number(s.sharePaise) })),
    version: e.version,
  };
}

function toPaymentDto(p: GroupPayment): GroupActivityDto {
  return { kind: 'payment', id: p.id, day: asDay(p.day), amountPaise: Number(p.amountPaise), fromId: p.fromId, toId: p.toId };
}

function encodeCursor(c: { day: string; id: string }): string {
  return Buffer.from(`${c.day}|${c.id}`).toString('base64url');
}

function decodeCursor(raw: string): { day: string; id: string } | null {
  const [day, id] = Buffer.from(raw, 'base64url').toString().split('|');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return day && id && /^\d{4}-\d{2}-\d{2}$/.test(day) && uuid.test(id) ? { day, id } : null;
}

const duplicateMember = () => new AppError('GROUP_MEMBER_DUPLICATE', 'Someone in this group already has that name', HttpStatus.CONFLICT);
const memberLimit = () => new AppError('GROUP_MEMBER_LIMIT', `A group can have up to ${GROUP_LIMITS.maxMembers} members`, HttpStatus.CONFLICT);
export const groupLimit = () => new AppError('GROUP_LIMIT', `You can be in up to ${GROUP_LIMITS.maxActiveGroups} active groups`, HttpStatus.CONFLICT);
const selfMember = (message: string) => new AppError('GROUP_MEMBER_SELF', message);
export { memberLimit };
