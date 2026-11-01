import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Goal, GoalContribution, Prisma } from '@prisma/client';
import { addDays, daysBetween, GOAL_LIMITS, goalProgress, istDateKey, newMilestones, type GoalContributionDay } from '@et/domain';
import { AppError, PrismaService } from '../common';
import type {
  ContributeDto,
  ContributionResultDto,
  CreateGoalDto,
  GoalContributionDto,
  GoalDetailDto,
  GoalDto,
  GoalStatusName,
  UpdateGoalDto,
} from './dto/goal.dto';
import { GOAL_REACHED, type GoalReachedEvent } from './goals.events';

type GoalWithDays = Goal & { contributions: Pick<GoalContribution, 'day' | 'amountPaise'>[] };

const DAYS_ONLY = { select: { day: true, amountPaise: true } } as const;
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const asDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Owns goals and goal_contributions. Saving towards a goal is not a ledger transaction: nothing
 * here touches transactions or ingest. Progress (daily amount, streak, days closer) comes from
 * @et/domain's goalProgress on every read, so it is never stale.
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Today in IST; a property so tests can move the clock. */
  today = (): string => istDateKey(new Date());

  async list(userId: string, status?: GoalStatusName): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { contributions: DAYS_ONLY },
      orderBy: [{ targetDay: 'asc' }, { createdAt: 'asc' }],
    });
    const today = this.today();
    return goals.map((g) => toDto(g, today));
  }

  async get(userId: string, id: string): Promise<GoalDetailDto> {
    const goal = await this.owned(userId, id);
    const recent = await this.prisma.goalContribution.findMany({ where: { goalId: id }, orderBy: [{ day: 'desc' }, { createdAt: 'desc' }], take: 90 });
    return { ...toDto(goal, this.today()), contributions: recent.map(toContributionDto) };
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const today = this.today();
    assertDeadline(today, dto.targetDay);
    const active = await this.prisma.goal.count({ where: { userId, status: 'active' } });
    if (active >= GOAL_LIMITS.maxActiveGoals) {
      throw new AppError('GOAL_LIMIT', `You can save for up to ${GOAL_LIMITS.maxActiveGoals} goals at a time`, HttpStatus.CONFLICT);
    }
    const goal = await this.prisma.goal.create({
      data: { userId, name: dto.name, emoji: dto.emoji ?? null, targetPaise: BigInt(dto.targetPaise), startDay: asDate(today), targetDay: asDate(dto.targetDay) },
      include: { contributions: DAYS_ONLY },
    });
    return toDto(goal, today);
  }

  /** A new target or deadline keeps what was saved; reached follows the new target. */
  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalDto> {
    const current = await this.owned(userId, id);
    const today = this.today();
    if (dto.targetDay !== undefined && dto.targetDay !== asDay(current.targetDay)) assertDeadline(today, dto.targetDay);
    const targetPaise = dto.targetPaise ?? Number(current.targetPaise);
    const reached = goalProgress(plan(current, { targetPaise }), days(current), today).reached;
    const archived = dto.status ? dto.status === 'archived' : current.status === 'archived';
    const status = archived ? 'archived' : reached ? 'reached' : 'active';
    const goal = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        targetPaise: BigInt(targetPaise),
        ...(dto.targetDay !== undefined ? { targetDay: asDate(dto.targetDay) } : {}),
        status,
        reachedAt: reached ? (current.reachedAt ?? new Date()) : null,
      },
      include: { contributions: DAYS_ONLY },
    });
    return toDto(goal, today);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.prisma.goal.delete({ where: { id } });
  }

  /**
   * Puts money aside for today (or yesterday, if it wasn't logged in time). Marks the goal reached
   * the first time the target is met, and says which milestones this reached.
   */
  async contribute(userId: string, id: string, dto: ContributeDto): Promise<ContributionResultDto> {
    const today = this.today();
    const day = dto.day === 'yesterday' ? addDays(today, -1) : today;
    const result = await this.prisma.$transaction(async (tx) => {
      const goal = await this.owned(userId, id, tx);
      if (goal.status === 'archived') throw new AppError('GOAL_ARCHIVED', 'Bring this goal back before saving towards it', HttpStatus.CONFLICT);
      if (goal.status === 'reached') throw new AppError('GOAL_REACHED', 'This goal is already reached', HttpStatus.CONFLICT);
      if (day < asDay(goal.startDay)) throw new AppError('VALIDATION_FAILED', "You can't save for a day before the goal started");
      const before = goalProgress(plan(goal), days(goal), today);
      await tx.goalContribution.create({ data: { goalId: id, day: asDate(day), amountPaise: BigInt(dto.amountPaise) } });
      const after = goalProgress(plan(goal), [...days(goal), { day, amountPaise: dto.amountPaise }], today);
      const updated = await tx.goal.update({
        where: { id },
        data: after.reached ? { status: 'reached', reachedAt: new Date() } : {},
        include: { contributions: DAYS_ONLY },
      });
      return { goal: toDto(updated, today), newMilestones: newMilestones(before.milestones, after.milestones), reachedNow: after.reached };
    });
    if (result.reachedNow) this.events.emit(GOAL_REACHED, { userId, goalId: id } satisfies GoalReachedEvent);
    return { goal: result.goal, newMilestones: result.newMilestones };
  }

  /** Takes back a contribution; a goal that drops below its target is active again. */
  async removeContribution(userId: string, id: string, contributionId: string): Promise<GoalDto> {
    return this.prisma.$transaction(async (tx) => {
      const goal = await this.owned(userId, id, tx);
      const removed = await tx.goalContribution.deleteMany({ where: { id: contributionId, goalId: id } });
      if (removed.count === 0) throw new AppError('NOT_FOUND', 'Contribution not found', HttpStatus.NOT_FOUND);
      const today = this.today();
      const rest = await tx.goalContribution.findMany({ where: { goalId: id }, ...DAYS_ONLY });
      const reached = goalProgress(plan(goal), rest.map(toDay), today).reached;
      const updated = await tx.goal.update({
        where: { id },
        data: goal.status === 'reached' && !reached ? { status: 'active', reachedAt: null } : {},
        include: { contributions: DAYS_ONLY },
      });
      return toDto(updated, today);
    });
  }

  /** The goal if it belongs to the user, else 404 (never reveals another user's goal). */
  private async owned(userId: string, id: string, tx: Prisma.TransactionClient = this.prisma): Promise<GoalWithDays> {
    const goal = await tx.goal.findFirst({ where: { id, userId }, include: { contributions: DAYS_ONLY } });
    if (!goal) throw new AppError('NOT_FOUND', 'Goal not found', HttpStatus.NOT_FOUND);
    return goal;
  }
}

function assertDeadline(today: string, targetDay: string): void {
  const valid = !Number.isNaN(Date.parse(`${targetDay}T00:00:00Z`)) && asDay(asDate(targetDay)) === targetDay;
  const days = valid ? daysBetween(today, targetDay) : 0;
  if (days < 1 || days > GOAL_LIMITS.maxDays) {
    throw new AppError('VALIDATION_FAILED', 'Pick a date from tomorrow up to 10 years ahead');
  }
}

function plan(goal: Goal, override: { targetPaise?: number } = {}) {
  return { targetPaise: override.targetPaise ?? Number(goal.targetPaise), startDay: asDay(goal.startDay), targetDay: asDay(goal.targetDay) };
}

function toDay(c: Pick<GoalContribution, 'day' | 'amountPaise'>): GoalContributionDay {
  return { day: asDay(c.day), amountPaise: Number(c.amountPaise) };
}

function days(goal: GoalWithDays): GoalContributionDay[] {
  return goal.contributions.map(toDay);
}

function toDto(goal: GoalWithDays, today: string): GoalDto {
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji,
    targetPaise: Number(goal.targetPaise),
    startDay: asDay(goal.startDay),
    targetDay: asDay(goal.targetDay),
    status: goal.status,
    reachedAt: goal.reachedAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
    progress: goalProgress(plan(goal), days(goal), today),
  };
}

function toContributionDto(c: GoalContribution): GoalContributionDto {
  return { id: c.id, day: asDay(c.day), amountPaise: Number(c.amountPaise), createdAt: c.createdAt.toISOString() };
}
