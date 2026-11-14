import { Injectable } from '@nestjs/common';
import { addDays } from '@et/domain';
import { LedgerStatsService } from '../../ingest';
import { bigSpend } from '../domain/messages';
import { BIG_SPEND, isBigSpend } from '../domain/policy';
import type { NotificationDraft } from '../domain/types';
import type { SpendContext, TransactionAlertRule } from './transaction-alert-rule';

/** "₹4,200 at Croma": at least twice the usual payment over the last 60 days, and ₹1,000+. */
@Injectable()
export class BigSpendRule implements TransactionAlertRule {
  readonly name = 'big_spend';

  constructor(private readonly stats: LedgerStatsService) {}

  async evaluate({ userId, today, transaction }: SpendContext): Promise<NotificationDraft | null> {
    if (transaction.amountPaise < BIG_SPEND.minPaise) return null;
    const typical = await this.stats.typicalDebit(userId, addDays(today, -BIG_SPEND.historyDays), addDays(today, -1));
    if (!isBigSpend(transaction.amountPaise, typical)) return null;
    return bigSpend(transaction.id, transaction.amountPaise, transaction.merchantName);
  }
}
