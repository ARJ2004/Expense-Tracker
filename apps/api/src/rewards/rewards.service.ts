import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { addDays, BADGE_CODES, BADGES, isUnderBudget, istDateKey, spendStreak, streakBadge, type BadgeCode, type DayOutcome } from '@et/domain';
import { BudgetsService } from '../budgets';
import { PrismaService } from '../common';
import type { RewardsDto, StreakDto } from './dto/rewards.dto';
import { BADGE_UNLOCKED, STREAK_MILESTONE, type BadgeUnlockedEvent, type StreakMilestoneEvent } from './rewards.events';

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const asDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Owns day_outcomes and badges. Closes each IST day once (its allowance and spend, from budgets),
 * works out the under-budget streak from those records and hands out badges.
 */
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly budgets: BudgetsService,
  ) {}

  /** Today in IST; a property so tests can move the clock. */
  today = (): string => istDateKey(new Date());

  async summary(userId: string): Promise<RewardsDto> {
    const today = this.today();
    const [outcomes, badges] = await Promise.all([this.outcomes(userId, addDays(today, -400)), this.prisma.badge.findMany({ where: { userId } })]);
    const unlocked = new Map(badges.map((b) => [b.code, b.unlockedAt]));
    const from = addDays(today, -14);
    return {
      streak: spendStreak(outcomes, today),
      last14: outcomes.filter((o) => o.day >= from).map((o) => ({ ...o, underBudget: isUnderBudget(o) })),
      badges: BADGE_CODES.map((code) => ({ ...BADGES[code], unlockedAt: unlocked.get(code)?.toISOString() ?? null })),
    };
  }

  async streak(userId: string): Promise<StreakDto> {
    const today = this.today();
    return spendStreak(await this.outcomes(userId, addDays(today, -400)), today);
  }

  /** Unlocks a badge once; true (and BADGE_UNLOCKED) only the first time. */
  async unlock(userId: string, code: BadgeCode): Promise<boolean> {
    const { count } = await this.prisma.badge.createMany({ data: [{ userId, code }], skipDuplicates: true });
    if (count > 0) this.events.emit(BADGE_UNLOCKED, { userId, code } satisfies BadgeUnlockedEvent);
    return count > 0;
  }

  /**
   * Closes `day` for one user: records its allowance and spend (once; a re-run changes nothing),
   * then the streak milestone, no-spend and month-on-budget badges it earned.
   */
  async closeDay(userId: string, day: string): Promise<void> {
    const allowance = await this.budgets.allowanceOn(userId, day);
    if (!allowance) return;
    const outcome: DayOutcome = { day, allowancePaise: allowance.allowancePaise, spentPaise: Math.max(0, allowance.spentTodayPaise) };
    const { count } = await this.prisma.dayOutcome.createMany({
      data: [{ userId, day: asDate(day), allowancePaise: BigInt(outcome.allowancePaise), spentPaise: BigInt(outcome.spentPaise) }],
      skipDuplicates: true,
    });
    if (count === 0) return;

    if (isUnderBudget(outcome)) {
      const { current } = spendStreak(await this.outcomes(userId, addDays(day, -400)), addDays(day, 1));
      const badge = streakBadge(current);
      if (badge) {
        this.events.emit(STREAK_MILESTONE, { userId, length: current } satisfies StreakMilestoneEvent);
        await this.unlock(userId, badge);
      }
      if (outcome.spentPaise === 0) await this.unlock(userId, 'no_spend_day');
    }

    // The last day of a month closes the month.
    if (addDays(day, 1).endsWith('-01')) {
      const result = await this.budgets.monthResult(userId, day.slice(0, 7));
      if (result && result.spentPaise <= result.budgetPaise) await this.unlock(userId, 'month_under_budget');
    }
  }

  /** Closes `day` for everyone with a plan; one user's failure doesn't stop the rest. */
  async closeDayForAll(day: string): Promise<void> {
    for (const userId of await this.budgets.userIdsWithPlan()) {
      try {
        await this.closeDay(userId, day);
      } catch (e) {
        this.logger.error(`close-day failed for a user: ${(e as Error).message}`);
      }
    }
  }

  /** How many closed days in [from, to] were under budget, and how many were closed. */
  async daysUnder(userId: string, from: string, to: string): Promise<{ under: number; closed: number }> {
    const outcomes = (await this.outcomes(userId, from)).filter((o) => o.day <= to);
    return { under: outcomes.filter(isUnderBudget).length, closed: outcomes.length };
  }

  private async outcomes(userId: string, from: string): Promise<DayOutcome[]> {
    const rows = await this.prisma.dayOutcome.findMany({ where: { userId, day: { gte: asDate(from) } }, orderBy: { day: 'asc' } });
    return rows.map((r) => ({ day: asDay(r.day), allowancePaise: Number(r.allowancePaise), spentPaise: Number(r.spentPaise) }));
  }
}
