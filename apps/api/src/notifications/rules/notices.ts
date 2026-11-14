import { Injectable } from '@nestjs/common';
import { addDays } from '@et/domain';
import { BudgetsService } from '../../budgets';
import { CategoriesService } from '../../categories';
import { LedgerStatsService } from '../../ingest';
import { RewardsService } from '../../rewards';
import { dailySummary, morningAllowance, streakAtRisk, weeklyRecap } from '../domain/messages';
import { STREAK_AT_RISK_SHARE } from '../domain/policy';
import type { NotificationDraft } from '../domain/types';
import type { ScheduledNotice } from './scheduled-notice';

/** 9 am: "You can spend ₹640 today". */
@Injectable()
export class MorningAllowanceNotice implements ScheduledNotice {
  readonly job = 'notify-morning-allowance';
  readonly cron = '0 9 * * *';

  constructor(
    private readonly budgets: BudgetsService,
    private readonly rewards: RewardsService,
  ) {}

  async build(userId: string, today: string): Promise<NotificationDraft | null> {
    const a = await this.budgets.allowanceOn(userId, today);
    if (!a || a.allowancePaise <= 0) return null;
    const { current } = await this.rewards.streak(userId);
    return morningAllowance(today, a.allowancePaise, current);
  }
}

/** 9 pm: today's spend against the allowance, or just today's spend without one. */
@Injectable()
export class DailySummaryNotice implements ScheduledNotice {
  readonly job = 'notify-daily-summary';
  readonly cron = '0 21 * * *';

  constructor(
    private readonly budgets: BudgetsService,
    private readonly stats: LedgerStatsService,
  ) {}

  async build(userId: string, today: string): Promise<NotificationDraft | null> {
    const a = await this.budgets.allowanceOn(userId, today);
    if (a && a.allowancePaise > 0) return dailySummary(today, Math.max(0, a.spentTodayPaise), a.allowancePaise);
    const spend = [...(await this.stats.spendByCategoryInDays(userId, today, today)).values()].reduce((s, p) => s + p, 0);
    return spend > 0 ? dailySummary(today, spend, null) : null;
  }
}

/** 8 pm: a streak of 2+ days with a quarter or less of today's allowance left. */
@Injectable()
export class StreakAtRiskNotice implements ScheduledNotice {
  readonly job = 'notify-streak-at-risk';
  readonly cron = '0 20 * * *';

  constructor(
    private readonly budgets: BudgetsService,
    private readonly rewards: RewardsService,
  ) {}

  async build(userId: string, today: string): Promise<NotificationDraft | null> {
    const { current } = await this.rewards.streak(userId);
    if (current < 2) return null;
    const a = await this.budgets.allowanceOn(userId, today);
    if (!a || a.allowancePaise <= 0 || a.leftTodayPaise < 0 || a.leftTodayPaise > a.allowancePaise * STREAK_AT_RISK_SHARE) return null;
    return streakAtRisk(today, current, a.leftTodayPaise);
  }
}

/** Sunday 6 pm: the week (Monday to today) in one line. */
@Injectable()
export class WeeklyRecapNotice implements ScheduledNotice {
  readonly job = 'notify-weekly-recap';
  readonly cron = '0 18 * * 0';

  constructor(
    private readonly stats: LedgerStatsService,
    private readonly rewards: RewardsService,
    private readonly categories: CategoriesService,
  ) {}

  async build(userId: string, today: string): Promise<NotificationDraft | null> {
    const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const spend = await this.stats.spendByCategoryInDays(userId, monday, today);
    const total = [...spend.values()].reduce((s, p) => s + p, 0);
    if (total === 0) return null;
    const [topId, topPaise] = [...spend].sort((a, b) => b[1] - a[1])[0]!;
    const name = (await this.categories.list(userId)).find((c) => c.id === topId)?.name ?? null;
    const under = await this.rewards.daysUnder(userId, monday, addDays(today, -1));
    return weeklyRecap(monday, total, name ? { name, paise: topPaise } : null, under);
  }
}
