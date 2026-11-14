import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BUDGET_SET, type BudgetSetEvent } from '../budgets';
import { GOAL_CREATED, GOAL_REACHED, type GoalCreatedEvent, type GoalReachedEvent } from '../goals';
import { RewardsService } from './rewards.service';

/** Badges for things done in other modules; those modules never know about rewards. */
@Injectable()
export class RewardsListener {
  constructor(private readonly rewards: RewardsService) {}

  @OnEvent(BUDGET_SET, { async: true, suppressErrors: true })
  async onBudgetSet(e: BudgetSetEvent): Promise<void> {
    await this.rewards.unlock(e.userId, 'first_budget');
  }

  @OnEvent(GOAL_CREATED, { async: true, suppressErrors: true })
  async onGoalCreated(e: GoalCreatedEvent): Promise<void> {
    await this.rewards.unlock(e.userId, 'first_goal');
  }

  @OnEvent(GOAL_REACHED, { async: true, suppressErrors: true })
  async onGoalReached(e: GoalReachedEvent): Promise<void> {
    await this.rewards.unlock(e.userId, 'goal_reached');
  }
}
