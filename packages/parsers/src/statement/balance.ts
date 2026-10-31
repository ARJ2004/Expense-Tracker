import type { StatementRow } from './types';

/**
 * Rows whose closing balance does not follow from the row before (previous balance ± amount).
 * Banks list rows oldest-first or newest-first; both orders are tried and the one with fewer
 * breaks wins. Rows without a balance are skipped. Returns the rowNo of each break.
 */
export function balanceBreaks(rows: readonly StatementRow[]): number[] {
  const withBalance = rows.filter((r) => r.balancePaise !== undefined);
  if (withBalance.length < 2) return [];
  const forward = breaks(withBalance);
  const backward = breaks([...withBalance].reverse());
  return (forward.length <= backward.length ? forward : backward).sort((a, b) => a - b);
}

function breaks(rows: readonly StatementRow[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const row = rows[i]!;
    const delta = row.direction === 'credit' ? row.amountPaise : -row.amountPaise;
    if (prev.balancePaise! + delta !== row.balancePaise) out.push(row.rowNo);
  }
  return out;
}
