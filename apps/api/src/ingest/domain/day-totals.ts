import { istDateKey, type Direction } from '@et/domain';

export interface DayTotal {
  /** IST calendar day, "2026-10-31". */
  date: string;
  debitPaise: number;
  creditPaise: number;
  /** creditPaise − debitPaise; what the day header shows. */
  netPaise: number;
}

/** Sums rows per IST day, newest day first. */
export function sumByIstDay(rows: { occurredAt: Date; direction: Direction; amountPaise: bigint }[]): DayTotal[] {
  const byDay = new Map<string, { debit: bigint; credit: bigint }>();
  for (const r of rows) {
    const key = istDateKey(r.occurredAt);
    const t = byDay.get(key) ?? { debit: 0n, credit: 0n };
    if (r.direction === 'debit') t.debit += r.amountPaise;
    else t.credit += r.amountPaise;
    byDay.set(key, t);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, t]) => ({ date, debitPaise: Number(t.debit), creditPaise: Number(t.credit), netPaise: Number(t.credit - t.debit) }));
}
