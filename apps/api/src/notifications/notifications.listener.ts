import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { istDateKey } from '@et/domain';
import { GOAL_MILESTONES, type GoalMilestonesEvent } from '../goals';
import { TRANSACTION_CREATED, TRANSACTIONS_INGESTED, type TransactionEvent, type TransactionsIngestedEvent } from '../ingest';
import { BADGE_UNLOCKED, STREAK_MILESTONE, type BadgeUnlockedEvent, type StreakMilestoneEvent } from '../rewards';
import { badgeUnlocked, goalMilestone, streakMilestone } from './domain/messages';
import { NotificationsService } from './notifications.service';
import { TransactionAlertsService } from './transaction-alerts.service';

/** A sync after days offline can bring many rows; only the newest few are looked at for alerts. */
const MAX_ALERT_CANDIDATES = 10;

/** Milestones in order of how much they're worth a push: one contribution buzzes once. */
const GOAL_MILESTONE_RANK = ['saved-100', 'saved-75', 'saved-50', 'saved-25', 'streak-30', 'streak-7', 'streak-3'];

/**
 * Turns other modules' events into notifications. Runs after the response (async) and never
 * fails the write that emitted the event: errors are logged without user data.
 */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly alerts: TransactionAlertsService,
  ) {}

  @OnEvent(TRANSACTION_CREATED, { async: true })
  async onCreated(e: TransactionEvent): Promise<void> {
    await this.safely('transaction alert', () => this.alerts.check(e.userId, [e.transactionId]));
  }

  @OnEvent(TRANSACTIONS_INGESTED, { async: true })
  async onIngested(e: TransactionsIngestedEvent): Promise<void> {
    if (e.createdIds.length === 0) return;
    await this.safely('batch alerts', () => this.alerts.check(e.userId, e.createdIds.slice(-MAX_ALERT_CANDIDATES)));
  }

  @OnEvent(STREAK_MILESTONE, { async: true })
  async onStreak(e: StreakMilestoneEvent): Promise<void> {
    await this.safely('streak', () => this.notifications.notify(e.userId, streakMilestone(istDateKey(this.notifications.now()), e.length)));
  }

  /** Streak badges come with their own streak push; every other badge gets one. */
  @OnEvent(BADGE_UNLOCKED, { async: true })
  async onBadge(e: BadgeUnlockedEvent): Promise<void> {
    if (e.code.startsWith('streak_')) return;
    await this.safely('badge', () => this.notifications.notify(e.userId, badgeUnlocked(e.code)));
  }

  @OnEvent(GOAL_MILESTONES, { async: true })
  async onGoal(e: GoalMilestonesEvent): Promise<void> {
    const top = GOAL_MILESTONE_RANK.find((m) => e.milestones.includes(m));
    const draft = top ? goalMilestone(e.goalId, e.name, e.emoji, top) : null;
    if (draft) await this.safely('goal', () => this.notifications.notify(e.userId, draft));
  }

  private async safely(what: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${what} notification failed: ${(err as Error).message}`);
    }
  }
}
