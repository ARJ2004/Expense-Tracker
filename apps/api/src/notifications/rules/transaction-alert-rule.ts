import type { NotificationDraft } from '../domain/types';

/** A spend that just landed in the ledger, for today (IST). */
export interface SpendContext {
  userId: string;
  today: string;
  transaction: { id: string; amountPaise: number; merchantName: string | null; categoryId: string };
}

/**
 * One kind of alert a new spend can trigger. Rules run in TRANSACTION_ALERT_RULES order and the
 * first that has something to say wins, so one payment buzzes the phone once.
 */
export interface TransactionAlertRule {
  readonly name: string;
  evaluate(ctx: SpendContext): Promise<NotificationDraft | null>;
}

export const TRANSACTION_ALERT_RULES = Symbol('TRANSACTION_ALERT_RULES');
