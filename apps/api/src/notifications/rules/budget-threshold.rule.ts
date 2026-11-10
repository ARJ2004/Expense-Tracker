import { Injectable } from '@nestjs/common';
import { crossedAlertLevel, daysLeftInMonth } from '@et/domain';
import { BudgetsService } from '../../budgets';
import { budgetThreshold } from '../domain/messages';
import type { NotificationDraft } from '../domain/types';
import type { SpendContext, TransactionAlertRule } from './transaction-alert-rule';

/** "Food is at 80%" / "Food budget used up": the payment pushed its category past a level. */
@Injectable()
export class BudgetThresholdRule implements TransactionAlertRule {
  readonly name = 'budget_threshold';

  constructor(private readonly budgets: BudgetsService) {}

  async evaluate({ userId, today, transaction }: SpendContext): Promise<NotificationDraft | null> {
    const b = await this.budgets.categoryThisMonth(userId, transaction.categoryId);
    if (!b) return null;
    const level = crossedAlertLevel(b.spentPaise - transaction.amountPaise, b.spentPaise, b.budgetPaise);
    if (!level) return null;
    const month = today.slice(0, 7);
    return budgetThreshold(month, transaction.categoryId, b.categoryName, level, b.budgetPaise - b.spentPaise, daysLeftInMonth(month, today));
  }
}
