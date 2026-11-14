import { Injectable } from '@nestjs/common';
import { BudgetsService } from '../../budgets';
import { overAllowance } from '../domain/messages';
import type { NotificationDraft } from '../domain/types';
import type { SpendContext, TransactionAlertRule } from './transaction-alert-rule';

/** Today's spend just went past the daily allowance (once a day). */
@Injectable()
export class OverAllowanceRule implements TransactionAlertRule {
  readonly name = 'over_allowance';

  constructor(private readonly budgets: BudgetsService) {}

  /** Fixed categories don't count towards the allowance; the dedup key keeps it to once a day. */
  async evaluate({ userId, today }: SpendContext): Promise<NotificationDraft | null> {
    const a = await this.budgets.allowanceOn(userId, today);
    if (!a || a.allowancePaise <= 0 || a.leftTodayPaise >= 0) return null;
    return overAllowance(today, -a.leftTodayPaise, a.daysLeft > 1);
  }
}
