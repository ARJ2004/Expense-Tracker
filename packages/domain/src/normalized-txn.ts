import type { Direction, SourceKind } from './enums';
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
  accountHint?: { bank?: string; last4?: string };
  counterparty?: string;
  narration?: string;
  referenceNo?: string;
  balancePaise?: Paise;
  /** Original text for audit; never logged. */
  rawText?: string;
}
