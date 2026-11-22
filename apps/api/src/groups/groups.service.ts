import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type GroupExpense, type GroupExpenseShare, type GroupMember, type GroupPayment } from '@prisma/client';
import { GROUP_LIMITS, istDateKey, memberNameKey, simplifyDebts } from '@et/domain';
import { AppError, PrismaService } from '../common';
import { SPLIT_STRATEGIES } from './domain/split-strategies';
import type {
  CreateGroupDto,
  GroupActivityDto,
  GroupActivityListDto,
  GroupDetailDto,
  GroupMemberDto,
  GroupSummaryDto,
  SaveExpenseDto,
  SavePaymentDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { GROUP_EXPENSE_CREATED, GROUP_SETTLED, type GroupExpenseCreatedEvent, type GroupSettledEvent } from './groups.events';

type Db = Prisma.TransactionClient;
type OwnedGroup = Prisma.GroupGetPayload<{ include: { members: true } }>;

/** Per member: what they paid, their shares, payments they made and payments they got. */
interface Totals {
  paid: number;
  share: number;
  sent: number;
  received: number;
}

const SELF_NAME = 'You';
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const asDay = (date: Date) => date.toISOString().slice(0, 10);
const MEMBERS_IN_ORDER = { members: { orderBy: { position: 'asc' } } } as const satisfies Prisma.GroupInclude;

/**
 * Owns groups, group_members, group_expenses, group_expense_shares and group_payments. Group
 * expenses are not ledger transactions: nothing here touches transactions or ingest. Balances
 * and "who pays whom" are worked out on every read from sums, so they are never stale.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Today in IST; a property so tests can move the clock. */
  today = (): string => istDateKey(new Date());

  // ---- Groups ----

  async list(userId: string, archived = false): Promise<GroupSummaryDto[]> {
    const groups = await this.prisma.group.findMany({
      where: { userId, archivedAt: archived ? { not: null } : null },
      include: { members: { select: { id: true, isSelf: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    const selfIds = groups.flatMap((g) => g.members.filter((m) => m.isSelf).map((m) => m.id));
    const totals = await this.totals(selfIds);
    return groups.map((g) => {
      const self = g.members.find((m) => m.isSelf);
      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        memberCount: g.members.length,
        myNetPaise: self ? net(totals.get(self.id)) : 0,
        archived: g.archivedAt !== null,
      };
    });
  }

  async get(userId: string, id: string): Promise<GroupDetailDto> {
    return this.detail(await this.owned(userId, id));
  }

  async create(userId: string, dto: CreateGroupDto): Promise<GroupDetailDto> {
    const names = [SELF_NAME, ...(dto.members ?? [])];
    const keys = names.map(memberNameKey);
    if (new Set(keys).size !== keys.length) throw duplicateMember();
    const active = await this.prisma.group.count({ where: { userId, archivedAt: null } });
    if (active >= GROUP_LIMITS.maxActiveGroups) throw groupLimit();
    const group = await this.prisma.group.create({
      data: {
        userId,
        name: dto.name,
        emoji: dto.emoji ?? null,
        members: { create: names.map((name, position) => ({ name, nameKey: memberNameKey(name), isSelf: position === 0, position })) },
      },
      include: MEMBERS_IN_ORDER,
    });
    return this.detail(group);
  }

  async update(userId: string, id: string, dto: UpdateGroupDto): Promise<GroupDetailDto> {
    const current = await this.owned(userId, id);
    if (dto.archived === false && current.archivedAt !== null) {
      const active = await this.prisma.group.count({ where: { userId, archivedAt: null } });
      if (active >= GROUP_LIMITS.maxActiveGroups) throw groupLimit();
    }
    const group = await this.prisma.group.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.archived !== undefined ? { archivedAt: dto.archived ? (current.archivedAt ?? new Date()) : null } : {}),
      },
      include: MEMBERS_IN_ORDER,
    });
    return this.detail(group);
  }

  /** Deletes the group with its members, expenses and payments (cascade). */
  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.prisma.group.delete({ where: { id } });
  }

  // ---- Members ----

  async addMember(userId: string, groupId: string, name: string): Promise<GroupMemberDto> {
    const group = await this.owned(userId, groupId);
    if (group.members.length >= GROUP_LIMITS.maxMembers) {
      throw new AppError('GROUP_MEMBER_LIMIT', `A group can have up to ${GROUP_LIMITS.maxMembers} members`, HttpStatus.CONFLICT);
    }
    const position = Math.max(...group.members.map((m) => m.position)) + 1;
    try {
      const member = await this.prisma.groupMember.create({ data: { groupId, name, nameKey: memberNameKey(name), position } });
      return toMemberDto(member);
    } catch (e) {
      throw isUniqueViolation(e) ? duplicateMember() : e;
    }
  }

  async renameMember(userId: string, groupId: string, memberId: string, name: string): Promise<GroupMemberDto> {
    const member = memberOf(await this.owned(userId, groupId), memberId);
    if (member.isSelf) throw selfMember('You can’t rename yourself');
    try {
      return toMemberDto(await this.prisma.groupMember.update({ where: { id: memberId }, data: { name, nameKey: memberNameKey(name) } }));
    } catch (e) {
      throw isUniqueViolation(e) ? duplicateMember() : e;
    }
  }

  /**
   * Only a member in no expense or payment can go. The member foreign keys cascade (so a whole
   * group deletes in one statement), so the check is here, inside the delete's transaction.
   */
  async removeMember(userId: string, groupId: string, memberId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = memberOf(await this.owned(userId, groupId, tx), memberId);
      if (member.isSelf) throw selfMember('You are always in your own groups');
      const [paid, shared, payments] = await Promise.all([
        tx.groupExpense.count({ where: { paidById: memberId } }),
        tx.groupExpenseShare.count({ where: { memberId } }),
        tx.groupPayment.count({ where: { OR: [{ fromId: memberId }, { toId: memberId }] } }),
      ]);
      if (paid + shared + payments > 0) {
        throw new AppError('GROUP_MEMBER_IN_USE', `${member.name} is part of an expense or payment. Remove them from those first.`, HttpStatus.CONFLICT);
      }
      await tx.groupMember.delete({ where: { id: memberId } });
    });
  }

  // ---- Expenses and payments ----

  async activity(userId: string, groupId: string, cursor: string | undefined, limit: number): Promise<GroupActivityListDto> {
    await this.owned(userId, groupId);
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

  async createExpense(userId: string, groupId: string, dto: SaveExpenseDto): Promise<GroupActivityDto> {
    const group = await this.owned(userId, groupId);
    const shares = this.split(group, dto);
    const expense = await this.prisma.groupExpense.create({
      data: {
        groupId,
        description: dto.description,
        amountPaise: BigInt(dto.amountPaise),
        paidById: dto.paidById,
        splitMode: dto.splitMode,
        day: asDate(dto.day),
        shares: { create: shares.map((s) => ({ memberId: s.memberId, sharePaise: BigInt(s.sharePaise) })) },
      },
      include: { shares: true },
    });
    await this.touch(groupId);
    this.events.emit(GROUP_EXPENSE_CREATED, { userId, groupId, expenseId: expense.id } satisfies GroupExpenseCreatedEvent);
    return toExpenseDto(expense);
  }

  /** Replaces an expense: its amount, payer, day and split. */
  async updateExpense(userId: string, groupId: string, expenseId: string, dto: SaveExpenseDto): Promise<GroupActivityDto> {
    const group = await this.owned(userId, groupId);
    const shares = this.split(group, dto);
    const expense = await this.prisma.$transaction(async (tx) => {
      const found = await tx.groupExpense.findFirst({ where: { id: expenseId, groupId } });
      if (!found) throw notFound('Expense');
      await tx.groupExpenseShare.deleteMany({ where: { expenseId } });
      return tx.groupExpense.update({
        where: { id: expenseId },
        data: {
          description: dto.description,
          amountPaise: BigInt(dto.amountPaise),
          paidById: dto.paidById,
          splitMode: dto.splitMode,
          day: asDate(dto.day),
          shares: { create: shares.map((s) => ({ memberId: s.memberId, sharePaise: BigInt(s.sharePaise) })) },
        },
        include: { shares: true },
      });
    });
    await this.touch(groupId);
    return toExpenseDto(expense);
  }

  async removeExpense(userId: string, groupId: string, expenseId: string): Promise<void> {
    await this.owned(userId, groupId);
    const { count } = await this.prisma.groupExpense.deleteMany({ where: { id: expenseId, groupId } });
    if (count === 0) throw notFound('Expense');
    await this.touch(groupId);
  }

  async createPayment(userId: string, groupId: string, dto: SavePaymentDto): Promise<GroupActivityDto> {
    const group = await this.owned(userId, groupId);
    this.assertDay(dto.day);
    if (dto.fromId === dto.toId) throw new AppError('GROUP_PAYMENT_SAME_MEMBER', 'Pick two different members');
    memberOf(group, dto.fromId, 'GROUP_UNKNOWN_MEMBER');
    memberOf(group, dto.toId, 'GROUP_UNKNOWN_MEMBER');
    const payment = await this.prisma.groupPayment.create({
      data: { groupId, fromId: dto.fromId, toId: dto.toId, amountPaise: BigInt(dto.amountPaise), day: asDate(dto.day) },
    });
    await this.touch(groupId);
    const totals = await this.totals(group.members.map((m) => m.id));
    if ([...totals.values()].every((t) => net(t) === 0)) {
      this.events.emit(GROUP_SETTLED, { userId, groupId } satisfies GroupSettledEvent);
    }
    return toPaymentDto(payment);
  }

  async removePayment(userId: string, groupId: string, paymentId: string): Promise<void> {
    await this.owned(userId, groupId);
    const { count } = await this.prisma.groupPayment.deleteMany({ where: { id: paymentId, groupId } });
    if (count === 0) throw notFound('Payment');
    await this.touch(groupId);
  }

  // ---- Internals ----

  /** The group if it belongs to the user, else 404 (never reveals another user's group). */
  private async owned(userId: string, id: string, db: Db = this.prisma): Promise<OwnedGroup> {
    const group = await db.group.findFirst({ where: { id, userId }, include: MEMBERS_IN_ORDER });
    if (!group) throw notFound('Group');
    return group;
  }

  private assertDay(day: string): void {
    if (day > this.today()) throw new AppError('VALIDATION_FAILED', 'The date can’t be in the future');
  }

  private split(group: OwnedGroup, dto: SaveExpenseDto) {
    this.assertDay(dto.day);
    memberOf(group, dto.paidById, 'GROUP_UNKNOWN_MEMBER');
    const strategy = SPLIT_STRATEGIES.find((s) => s.mode === dto.splitMode);
    if (!strategy) throw new AppError('VALIDATION_FAILED', 'Unknown split');
    const result = strategy.compute({ amountPaise: dto.amountPaise, memberOrder: group.members.map((m) => m.id), memberIds: dto.memberIds, shares: dto.shares });
    if (!result.ok) throw new AppError(result.code, result.message);
    return result.shares;
  }

  /** Keeps the most recently used groups at the top of the list. */
  private async touch(groupId: string): Promise<void> {
    await this.prisma.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
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

  private async detail(group: OwnedGroup): Promise<GroupDetailDto> {
    const ids = group.members.map((m) => m.id);
    const totals = await this.totals(ids);
    const balances = new Map(ids.map((id) => [id, net(totals.get(id))]));
    const self = group.members.find((m) => m.isSelf);
    const selfTotals = self ? totals.get(self.id) : undefined;
    const spent = [...totals.values()].reduce((sum, t) => sum + t.paid, 0);
    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      archived: group.archivedAt !== null,
      members: group.members.map(toMemberDto),
      balances: ids.map((memberId) => ({ memberId, netPaise: balances.get(memberId) ?? 0 })),
      transfers: simplifyDebts(balances),
      settled: [...balances.values()].every((v) => v === 0),
      totalSpentPaise: spent,
      mySharePaise: selfTotals?.share ?? 0,
      myNetPaise: net(selfTotals),
    };
  }
}

/** Positive: gets money back. Negative: owes. */
function net(t: Totals | undefined): number {
  return t ? t.paid - t.share + t.sent - t.received : 0;
}

function memberOf(group: OwnedGroup, memberId: string, code = 'NOT_FOUND'): GroupMember {
  const member = group.members.find((m) => m.id === memberId);
  if (!member) {
    throw code === 'NOT_FOUND' ? notFound('Member') : new AppError(code, 'That member is not in this group');
  }
  return member;
}

function toMemberDto(m: GroupMember): GroupMemberDto {
  return { id: m.id, name: m.name, isSelf: m.isSelf };
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

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`, HttpStatus.NOT_FOUND);
const duplicateMember = () => new AppError('GROUP_MEMBER_DUPLICATE', 'Someone in this group already has that name', HttpStatus.CONFLICT);
const groupLimit = () => new AppError('GROUP_LIMIT', `You can have up to ${GROUP_LIMITS.maxActiveGroups} active groups`, HttpStatus.CONFLICT);
const selfMember = (message: string) => new AppError('GROUP_MEMBER_SELF', message);
