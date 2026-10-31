import { paise, type AccountKind, type NormalizedTxn } from '@et/domain';
import type { SourceInput } from './source-input';

/** One device-parsed row as the API receives it (the shape of CapturedTxnDto). */
export interface CapturedTxn {
  source: 'sms';
  messageKey: string;
  amountPaise: number;
  direction: NormalizedTxn['direction'];
  occurredAt: string;
  timePrecision: NormalizedTxn['timePrecision'];
  bank: string;
  last4?: string;
  accountKind?: AccountKind;
  counterparty?: string;
  referenceNo?: string;
  narration?: string;
}

const MAX_FUTURE_MS = 86_400_000;

/**
 * The row as ingest sees it, and what makes it idempotent. Throws RangeError for a time more than a
 * day ahead (a phone clock far off), which the service counts as rejected.
 */
export function capturedToIngest(item: CapturedTxn, now: Date = new Date()): { txn: NormalizedTxn; source: SourceInput } {
  const occurredAt = new Date(item.occurredAt);
  if (occurredAt.getTime() > now.getTime() + MAX_FUTURE_MS) throw new RangeError('occurredAt is in the future');
  const txn: NormalizedTxn = {
    source: item.source,
    amountPaise: paise(item.amountPaise),
    direction: item.direction,
    occurredAt,
    timePrecision: item.timePrecision,
    accountHint: { bank: item.bank, ...(item.last4 ? { last4: item.last4 } : {}), ...(item.accountKind ? { kind: item.accountKind } : {}) },
  };
  const counterparty = item.counterparty?.trim();
  if (counterparty) txn.counterparty = counterparty;
  if (item.referenceNo) txn.referenceNo = item.referenceNo.toUpperCase();
  if (item.narration) txn.narration = item.narration;
  return { txn, source: { kind: 'sms', messageKey: item.messageKey } };
}

/** Same bank, digits and kind → one account lookup per batch. */
export function hintKey(hint: NonNullable<NormalizedTxn['accountHint']>): string {
  return [hint.bank?.trim().toLowerCase() ?? '', hint.last4 ?? '', hint.kind ?? ''].join('|');
}
