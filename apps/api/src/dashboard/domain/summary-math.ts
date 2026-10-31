/**
 * Left to spend and % used. Until budgets (v0.3), the monthly income from the profile is the
 * limit. Without one, both are null and Home shows spend and income only.
 */
export function budgetFigures(spendPaise: number, monthlyIncomePaise: number | null): { leftToSpendPaise: number | null; usedPercent: number | null } {
  if (!monthlyIncomePaise || monthlyIncomePaise <= 0) return { leftToSpendPaise: null, usedPercent: null };
  return {
    // Negative when over: Home says "Over by ₹…".
    leftToSpendPaise: monthlyIncomePaise - spendPaise,
    // Integer percent, rounded down so 99.6% doesn't read as "100% used" too early.
    usedPercent: Math.floor((spendPaise * 100) / monthlyIncomePaise),
  };
}

/** Longest trend ranges, so one request can't ask for years of daily buckets. */
export const MAX_TREND_BUCKETS = { day: 92, week: 106, month: 24 } as const;

/** Number of buckets between two IST days (inclusive). */
export function bucketCount(from: string, to: string, bucket: 'day' | 'week' | 'month'): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (bucket === 'month') return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return bucket === 'day' ? days : Math.ceil(days / 7) + 1;
}
