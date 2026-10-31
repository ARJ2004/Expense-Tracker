import type { Direction, SourceKind, TxnType } from './enums';

/**
 * What the Transactions screen can filter by. Every field narrows the list; an empty object is
 * the whole ledger. Dates are IST calendar days ("2026-10-31"), amounts integer paise.
 */
export interface LedgerFilters {
  from?: string;
  to?: string;
  direction?: Direction;
  categoryIds?: string[];
  type?: TxnType;
  source?: SourceKind;
  accountId?: string;
  minAmountPaise?: number;
  maxAmountPaise?: number;
  /** Matches merchant or note, case-insensitive, anywhere in the text. */
  q?: string;
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

/** The UTC instants an IST calendar day starts and ends at: [start, end). */
export function istDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** True for a real calendar date in "YYYY-MM-DD" form. */
export function isDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(value);
}

/** Number of filters in use, for the badge on the filter button (search is not counted). */
export function activeFilterCount(f: LedgerFilters): number {
  return [
    f.from || f.to,
    f.direction,
    f.categoryIds?.length,
    f.type,
    f.source,
    f.accountId,
    f.minAmountPaise !== undefined || f.maxAmountPaise !== undefined,
  ].filter(Boolean).length;
}
