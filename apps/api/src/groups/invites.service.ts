import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { GroupInvite, GroupMember } from '@prisma/client';
import { formatInviteCode, GROUP_LIMITS, inviteCodeFrom, memberNameKey, normalizeInviteCode, uniqueMemberName } from '@et/domain';
import { AppError, PrismaService } from '../common';
import type { AcceptInviteDto, GroupDetailDto, InviteDto, InvitePreviewDto, InviteStateDto, PublicInvitePreviewDto } from './dto/group.dto';
import { GroupStore, type LoadedGroup } from './group-store';
import { GROUP_MEMBER_JOINED, type GroupMemberJoinedEvent } from './groups.events';
import { groupLimit, GroupsService, memberLimit } from './groups.service';

/** Where links point until the app has a domain: the API behind Nginx on the EC2 IP. */
export const DEFAULT_PUBLIC_WEB_BASE_URL = 'http://15.252.181.82/altus';

/**
 * Join links. A group has at most one active link; anyone in the group can see and share it, only
 * the owner can reset or turn it off. Anyone signed in with the link joins at once (the owner can
 * remove them), either as one of the names already in the group or as a new name.
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: GroupStore,
    private readonly groups: GroupsService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async current(userId: string, groupId: string): Promise<InviteStateDto> {
    await this.store.read(userId, groupId);
    const invite = await this.prisma.groupInvite.findFirst({ where: { groupId, revokedAt: null } });
    return invite ? { active: true, invite: this.toDto(invite) } : { active: false };
  }

  /** The active link, made if there is none. `reset` (owner only) turns the old one off first. */
  async share(userId: string, groupId: string, reset = false): Promise<InviteDto> {
    return this.store.write(userId, groupId, async (ctx) => {
      const active = await ctx.tx.groupInvite.findFirst({ where: { groupId, revokedAt: null } });
      if (active && !reset) return this.toDto(active);
      if (active) {
        this.store.requireOwner(ctx, userId);
        await ctx.tx.groupInvite.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
        ctx.record('invite.reset', {});
      }
      for (let attempt = 0; ; attempt++) {
        const code = inviteCodeFrom(randomBytes(7));
        const clash = await ctx.tx.groupInvite.count({ where: { code } });
        if (clash === 0) return this.toDto(await ctx.tx.groupInvite.create({ data: { groupId, code } }));
        if (attempt >= 4) throw new Error('Could not make a unique join code');
      }
    });
  }

  /** Owner only: the link stops working; nobody new can join until it's shared again. */
  async turnOff(userId: string, groupId: string): Promise<void> {
    await this.store.write(userId, groupId, async (ctx) => {
      this.store.requireOwner(ctx, userId);
      await ctx.tx.groupInvite.updateMany({ where: { groupId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  /** What the join screen shows: the group, who invited, and the names to pick from. */
  async preview(userId: string, rawCode: string): Promise<InvitePreviewDto> {
    const { group } = await this.active(rawCode);
    return {
      groupId: group.id,
      groupName: group.name,
      emoji: group.emoji,
      invitedBy: ownerName(group),
      members: group.members.map((m) => ({ id: m.id, name: m.name, joined: m.userId !== null })),
      alreadyMember: group.members.some((m) => m.userId === userId),
    };
  }

  /** For the web page anyone with the link can open: never members or amounts. */
  async publicPreview(rawCode: string): Promise<PublicInvitePreviewDto> {
    const { group } = await this.active(rawCode);
    return { groupName: group.name, emoji: group.emoji, invitedBy: ownerName(group) };
  }

  /**
   * Joins the caller to the link's group. Claiming a name links it (with its history) to the
   * caller; two people claiming the same name at once are serialised by the group lock and the
   * second is told it's taken. Already in the group: returns it, so a retry is harmless.
   */
  async accept(userId: string, rawCode: string, dto: AcceptInviteDto): Promise<GroupDetailDto> {
    const { invite } = await this.active(rawCode);
    const groupId = invite.groupId;
    await this.store.write(
      userId,
      groupId,
      async (ctx) => {
        const still = await ctx.tx.groupInvite.findFirst({ where: { id: invite.id, revokedAt: null } });
        if (!still) throw inviteNotFound();
        if (ctx.me) return;
        const active = await ctx.tx.groupMember.count({ where: { userId, archivedAt: null } });
        if (active >= GROUP_LIMITS.maxActiveGroups) throw groupLimit();
        let member: GroupMember;
        let claimed = false;
        if (dto.memberId) {
          const wanted = ctx.group.members.find((m) => m.id === dto.memberId);
          if (!wanted) throw new AppError('NOT_FOUND', 'Member not found', HttpStatus.NOT_FOUND);
          const { count } = await ctx.tx.groupMember.updateMany({ where: { id: wanted.id, userId: null }, data: { userId, joinedAt: new Date() } });
          if (count === 0) {
            throw new AppError('GROUP_MEMBER_ALREADY_LINKED', `Someone already joined as ${wanted.name}. Pick another name or join as yourself.`, HttpStatus.CONFLICT);
          }
          member = { ...wanted, userId };
          claimed = true;
        } else {
          if (ctx.group.members.length >= GROUP_LIMITS.maxMembers) throw memberLimit();
          const name = uniqueMemberName(
            ctx.group.members.map((m) => m.name),
            dto.name ?? 'Member',
          );
          const position = Math.max(...ctx.group.members.map((m) => m.position)) + 1;
          member = await ctx.tx.groupMember.create({ data: { groupId, name, nameKey: memberNameKey(name), position, userId, joinedAt: new Date() } });
        }
        ctx.record('member.joined', { name: member.name, claimed }, member.id);
        const recipientUserIds = ctx.group.ownerId !== userId ? [ctx.group.ownerId] : [];
        ctx.after(() =>
          this.events.emit(GROUP_MEMBER_JOINED, { groupId, groupName: ctx.group.name, memberName: member.name, recipientUserIds } satisfies GroupMemberJoinedEvent),
        );
      },
      { members: 'anyone' },
    );
    return this.groups.get(userId, groupId);
  }

  /** The active invite for a code and its group, or 404 (unknown, turned off, group gone: all alike). */
  private async active(rawCode: string): Promise<{ invite: GroupInvite; group: LoadedGroup }> {
    const code = normalizeInviteCode(rawCode);
    if (!code) throw inviteNotFound();
    const invite = await this.prisma.groupInvite.findFirst({
      where: { code, revokedAt: null },
      include: { group: { include: { members: { orderBy: { position: 'asc' } } } } },
    });
    if (!invite) throw inviteNotFound();
    return { invite, group: invite.group };
  }

  private toDto(invite: GroupInvite): InviteDto {
    const base = (this.config.get<string>('PUBLIC_WEB_BASE_URL') || DEFAULT_PUBLIC_WEB_BASE_URL).replace(/\/+$/, '');
    return { code: invite.code, displayCode: formatInviteCode(invite.code), url: `${base}/j/${invite.code}` };
  }
}

function ownerName(group: LoadedGroup): string {
  return group.members.find((m) => m.userId === group.ownerId)?.name ?? 'Someone';
}

const inviteNotFound = () => new AppError('INVITE_NOT_FOUND', 'This link doesn’t work any more. Ask for a new one.', HttpStatus.NOT_FOUND);
