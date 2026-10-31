import { paise, type Direction, type NormalizedTxn } from '@et/domain';
import type { SourceInput } from '../../ingest';

/** An import_rows record as the imports module reads it. */
export interface StoredRow {
  occurredOn: Date;
  amountPaise: bigint;
  direction: Direction;
  narration: string;
  merchantName: string | null;
  referenceNo: string | null;
  balancePaise: bigint | null;
  nth: number;
  editedJson: unknown;
}

/** What the user may change on a row in review. */
export interface RowEdits {
  amountPaise?: number;
  /** "YYYY-MM-DD". */
  occurredOn?: string;
  merchantName?: string | null;
}

/** "2026-10-31" → 31 Oct 00:00 IST. Statement rows carry a day, so dedup compares by IST day. */
export function istMidnight(day: string): Date {
  return new Date(`${day}T00:00:00+05:30`);
}

export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function editsOf(row: StoredRow): RowEdits {
  return (row.editedJson ?? {}) as RowEdits;
}

/** The row as ingest sees it: the user's edits over the parsed values. */
export function toNormalizedTxn(row: StoredRow, accountId: string | null): NormalizedTxn {
  const edits = editsOf(row);
  const merchant = edits.merchantName !== undefined ? edits.merchantName : row.merchantName;
  const txn: NormalizedTxn = {
    source: 'statement',
    amountPaise: paise(edits.amountPaise ?? Number(row.amountPaise)),
    direction: row.direction,
    occurredAt: istMidnight(edits.occurredOn ?? dayOf(row.occurredOn)),
    timePrecision: 'day',
    narration: row.narration,
  };
  if (merchant) txn.counterparty = merchant;
  if (row.referenceNo) txn.referenceNo = row.referenceNo;
  if (row.balancePaise !== null && row.balancePaise >= 0n) txn.balancePaise = paise(Number(row.balancePaise));
  if (accountId) txn.accountId = accountId;
  return txn;
}

/** Always the parsed values (never edits), so re-importing the same file is a no-op. */
export function toSourceInput(row: StoredRow): SourceInput {
  return {
    kind: 'statement',
    date: dayOf(row.occurredOn),
    amountPaise: Number(row.amountPaise),
    direction: row.direction,
    narration: row.narration,
    ...(row.balancePaise !== null ? { balancePaise: Number(row.balancePaise) } : {}),
    nth: row.nth,
  };
}
