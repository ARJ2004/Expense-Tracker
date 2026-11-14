import { Inject, Injectable } from '@nestjs/common';
import { istDateKey } from '@et/domain';
import { LedgerQueryService } from '../ingest';
import { NotificationsService } from './notifications.service';
import { TRANSACTION_ALERT_RULES, type TransactionAlertRule } from './rules/transaction-alert-rule';

const SPEND_TYPES = new Set(['expense', 'atm_withdrawal']);

/** Runs the alert rules over spends that just landed. Old rows (a statement import) never alert. */
@Injectable()
export class TransactionAlertsService {
  constructor(
    private readonly ledger: LedgerQueryService,
    private readonly notifications: NotificationsService,
    @Inject(TRANSACTION_ALERT_RULES) private readonly rules: TransactionAlertRule[],
  ) {}

  async check(userId: string, transactionIds: string[]): Promise<void> {
    const today = istDateKey(this.notifications.now());
    for (const id of transactionIds) {
      const t = await this.ledger.get(userId, id);
      if (t.direction !== 'debit' || !SPEND_TYPES.has(t.type) || istDateKey(new Date(t.occurredAt)) !== today) continue;
      const ctx = { userId, today, transaction: { id: t.id, amountPaise: t.amountPaise, merchantName: t.merchantName, categoryId: t.category.id } };
      for (const rule of this.rules) {
        const draft = await rule.evaluate(ctx);
        if (draft) {
          await this.notifications.notify(userId, draft);
          break;
        }
      }
    }
  }
}
