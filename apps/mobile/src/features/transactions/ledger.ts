import type { DayTotal, ListTransactionsQuery, TransactionSummary } from '@et/api-client';
import { formatISTDate, istDateKey, istDayRange, type LedgerFilters } from '@et/domain';

/** What the ledger list renders: a day header, then that day's rows. */
export type LedgerItem =
  | { kind: 'day'; key: string; label: string; netPaise: number }
  | { kind: 'row'; key: string; txn: TransactionSummary };

/** "Today", "Yesterday · 30 Oct", "29 Oct", or "29 Oct 2025" outside the current year, all in IST. */
export function dayLabel(day: string, now: Date = new Date()): string {
  const start = istDayRange(day).start;
  const today = istDateKey(now);
  const short = formatISTDate(start, { year: day.slice(0, 4) !== today.slice(0, 4) });
  if (day === today) return 'Today';
  if (day === istDateKey(new Date(now.getTime() - 86_400_000))) return `Yesterday · ${short}`;
  return short;
}

/**
 * Groups rows by IST day under headers. Totals come from the API, which counts the whole day
 * even when part of it is on a page not loaded yet.
 */
export function toLedgerItems(rows: readonly TransactionSummary[], dayTotals: readonly DayTotal[], now: Date = new Date()): LedgerItem[] {
  const net = new Map(dayTotals.map((d) => [d.date, d.netPaise]));
  const items: LedgerItem[] = [];
  let current: string | null = null;
  for (const txn of rows) {
    const day = istDateKey(new Date(txn.occurredAt));
    if (day !== current) {
      current = day;
      items.push({ kind: 'day', key: `day-${day}`, label: dayLabel(day, now), netPaise: net.get(day) ?? 0 });
    }
    items.push({ kind: 'row', key: txn.id, txn });
  }
  return items;
}

/** The API's query parameters for a filter object (categoryIds → repeated categoryId). */
export function filtersToQuery({ categoryIds, ...rest }: LedgerFilters): ListTransactionsQuery {
  const query: ListTransactionsQuery = { ...rest };
  if (categoryIds?.length) query.categoryId = categoryIds;
  for (const key of Object.keys(query) as (keyof ListTransactionsQuery)[]) {
    if (query[key] === undefined || query[key] === '') delete query[key];
  }
  return query;
}

export type DatePreset = 'any' | 'this_month' | 'last_month' | 'last_90_days';

/** IST calendar bounds for a date chip in the filter sheet. */
export function presetRange(preset: DatePreset, now: Date = new Date()): Pick<LedgerFilters, 'from' | 'to'> {
  const today = istDateKey(now);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const day = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  switch (preset) {
    case 'this_month':
      return { from: day(y, m, 1), to: today };
    case 'last_month':
      return { from: day(y, m - 1, 1), to: day(y, m, 0) };
    case 'last_90_days':
      return { from: istDateKey(new Date(now.getTime() - 89 * 86_400_000)), to: today };
    default:
      return {};
  }
}

/** Which chip a from/to pair came from; filters only ever hold preset ranges. */
export function presetOf(f: Pick<LedgerFilters, 'from' | 'to'>, now: Date = new Date()): DatePreset {
  if (!f.from && !f.to) return 'any';
  const presets: DatePreset[] = ['this_month', 'last_month', 'last_90_days'];
  return presets.find((p) => {
    const r = presetRange(p, now);
    return r.from === f.from && r.to === f.to;
  }) ?? 'any';
}
