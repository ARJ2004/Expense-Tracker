import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type GroupMember } from '@prisma/client';
import type { GroupEventSummary, GroupEventType } from '@et/domain';
import { AppError, PrismaService } from '../common';

export type Db = Prisma.TransactionClient;
export type LoadedGroup = Prisma.GroupGetPayload<{ include: { members: true } }>;

const MEMBERS_IN_ORDER = { members: { orderBy: { position: 'asc' } } } as const satisfies Prisma.GroupInclude;

/** What a write sees: the locked group with its members, the caller's member, and hooks. */
export interface WriteContext {
  tx: Db;
  group: LoadedGroup;
  /** The caller's linked member; undefined only for writes that allow non-members (joining). */
  me: GroupMember | undefined;
  /** Adds a history row, written in the same transaction. The actor is `me` unless given. */
  record(type: GroupEventType, summary: GroupEventSummary, actorMemberId?: string | null): void;
  /** Runs after the commit (events for notifications); never inside the transaction. */
  after(fn: () => void): void;
}

/**
 * The one way groups are read and written. Reads require the caller to be a linked member (else
 * 404, so other people's groups are invisible). Every write locks the group row first, so writes
 * to one group happen one at a time while different groups never wait on each other; then it
 * bumps the group's rev and writes history in the same transaction. That is what keeps everyone
 * in a group consistent: one copy of the rows, changed in order, with a record of each change.
 */
@Injectable()
export class GroupStore {
  constructor(private readonly prisma: PrismaService) {}

  /** The group and the caller's member, or 404 when the caller isn't in it. */
  async read(userId: string, groupId: string, db: Db = this.prisma): Promise<{ group: LoadedGroup; me: GroupMember }> {
    const group = await db.group.findUnique({ where: { id: groupId }, include: MEMBERS_IN_ORDER });
    const me = group?.members.find((m) => m.userId === userId);
    if (!group || !me) throw notFound('Group');
    return { group, me };
  }

  async write<T>(userId: string, groupId: string, fn: (ctx: WriteContext) => Promise<T>, options: { members?: 'only' | 'anyone' } = {}): Promise<T> {
    const afterCommit: Array<() => void> = [];
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM groups WHERE id = ${groupId}::uuid FOR UPDATE`;
      if (locked.length === 0) throw notFound('Group');
      const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: MEMBERS_IN_ORDER });
      const me = group.members.find((m) => m.userId === userId);
      if (!me && options.members !== 'anyone') throw notFound('Group');
      const events: Prisma.GroupEventCreateManyInput[] = [];
      const ctx: WriteContext = {
        tx,
        group,
        me,
        record: (type, summary, actorMemberId) =>
          events.push({ groupId, type, summary: summary as Prisma.InputJsonObject, actorMemberId: actorMemberId === undefined ? (me?.id ?? null) : actorMemberId }),
        after: (f) => afterCommit.push(f),
      };
      const value = await fn(ctx);
      // A deleted group has nothing left to bump.
      const exists = await tx.group.count({ where: { id: groupId } });
      if (exists) {
        await tx.group.update({ where: { id: groupId }, data: { rev: { increment: 1 } } });
        if (events.length) await tx.groupEvent.createMany({ data: events });
      }
      return value;
    });
    afterCommit.forEach((f) => f());
    return result;
  }

  /** 403 unless the caller owns the group. */
  requireOwner(ctx: { group: LoadedGroup }, userId: string): void {
    if (ctx.group.ownerId !== userId) throw new AppError('GROUP_OWNER_ONLY', 'Only the group’s owner can do that', HttpStatus.FORBIDDEN);
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`, HttpStatus.NOT_FOUND);
