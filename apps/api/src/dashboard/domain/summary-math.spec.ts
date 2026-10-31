import { bucketCount, budgetFigures } from './summary-math';

describe('budgetFigures', () => {
  it('compares spend with monthly income', () => {
    expect(budgetFigures(4_218_000, 7_500_000)).toEqual({ leftToSpendPaise: 3_282_000, usedPercent: 56 });
  });
  it('goes negative when over, and is null without income', () => {
    expect(budgetFigures(8_000_000, 7_500_000)).toEqual({ leftToSpendPaise: -500_000, usedPercent: 106 });
    expect(budgetFigures(100, null)).toEqual({ leftToSpendPaise: null, usedPercent: null });
    expect(budgetFigures(100, 0)).toEqual({ leftToSpendPaise: null, usedPercent: null });
  });
  it('rounds the percent down', () => {
    expect(budgetFigures(9_960, 10_000).usedPercent).toBe(99);
  });
});

describe('bucketCount', () => {
  it('counts days, weeks and months inclusively', () => {
    expect(bucketCount('2026-10-01', '2026-10-31', 'day')).toBe(31);
    expect(bucketCount('2026-05-01', '2026-10-31', 'month')).toBe(6);
    expect(bucketCount('2025-11-01', '2026-10-31', 'month')).toBe(12);
    expect(bucketCount('2026-10-01', '2026-10-31', 'week')).toBeGreaterThanOrEqual(5);
  });
});
