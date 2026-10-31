import type { AccountKind, Direction, SourceKind } from './enums';
import type { Paise } from './money';

/**
 * What every source (manual entry, statement row, SMS, notification) produces
 * before handing it to the ingest pipeline.
 */
export interface NormalizedTxn {
  source: SourceKind;
  amountPaise: Paise;
  direction: Direction;
  occurredAt: Date;
  /** Statement rows often carry only a date; dedup then compares by IST day. */
  timePrecision: 'minute' | 'day';
  /**
   * What the source says about the account. last4 may be only the last 3 digits (some SBI SMS
   * say "A/c X123"); kind is set when the source tells (a card SMS says "Credit Card").
   */
  accountHint?: { bank?: string; last4?: string; kind?: AccountKind };
  counterparty?: string;
  narration?: string;
  referenceNo?: string;
  balancePaise?: Paise;
  /** Original text for audit; never logged. */
  rawText?: string;
  /** Manual entry only: the account the user picked (already known, no resolve needed). */
  accountId?: string;
  /** Manual entry only: the category the user picked; wins over every rule. */
  categoryId?: string;
  /** Free text from the user. */
  note?: string;
}
