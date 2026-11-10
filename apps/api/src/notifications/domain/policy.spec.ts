import { budgetThreshold, dailySummary, goalMilestone, morningAllowance } from './messages';
import { isBigSpend, pushVerdict } from './policy';

/** A UTC instant for an IST wall-clock hour on 11 Nov 2026. */
const ist = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 11, hour, minute) - 330 * 60_000);

describe('pushVerdict', () => {
  it('holds pushes between 22:00 and 08:00 IST', () => {
    expect(pushVerdict('big_spend', ist(21, 59), 0)).toBe('send');
    expect(pushVerdict('big_spend', ist(22), 0)).toBe('quiet_hours');
    expect(pushVerdict('big_spend', ist(7, 59), 0)).toBe('quiet_hours');
    expect(pushVerdict('morning_allowance', ist(8), 0)).toBe('send');
  });

  it('caps a day at 3 pushes, except the evening summary', () => {
    expect(pushVerdict('budget_threshold', ist(12), 3)).toBe('daily_cap');
    expect(pushVerdict('daily_summary', ist(21), 5)).toBe('send');
  });
});

describe('isBigSpend', () => {
  it('needs twice the median, ₹1,000 and some history', () => {
    expect(isBigSpend(4_200_00, { medianPaise: 400_00, count: 30 })).toBe(true);
    expect(isBigSpend(700_00, { medianPaise: 300_00, count: 30 })).toBe(false);
    expect(isBigSpend(3_000_00, { medianPaise: 2_000_00, count: 30 })).toBe(false);
    expect(isBigSpend(9_000_00, { medianPaise: 100_00, count: 3 })).toBe(false);
  });
});

describe('messages', () => {
  it('shows whole rupees with Indian grouping', () => {
    expect(morningAllowance('2026-11-11', 1_24_000_50, 5).title).toBe('You can spend ₹1,24,001 today');
    expect(morningAllowance('2026-11-11', 640_00, 5).body).toContain('🔥 5-day streak');
    expect(morningAllowance('2026-11-11', 640_00, 1).body).not.toContain('streak');
  });

  it('words the evening summary by how the day went', () => {
    expect(dailySummary('d', 1_240_00, 1_620_00).title).toBe('Today ₹1,240 · ₹380 under 🎯');
    expect(dailySummary('d', 1_840_00, 1_620_00).title).toBe('Today ₹1,840 · ₹220 over');
    expect(dailySummary('d', 0, 1_620_00).title).toBe('A no-spend day 🧘');
    expect(dailySummary('d', 500_00, null).title).toBe('Today you spent ₹500');
  });

  it('keys budget alerts by month, category and level so each goes once', () => {
    const m = budgetThreshold('2026-11', 'cat-1', 'Food', 80, 1_600_00, 9);
    expect(m.dedupKey).toBe('budget_threshold:2026-11:cat-1:80');
    expect(m.body).toBe('₹1,600 left for 9 days');
    expect(budgetThreshold('2026-11', 'cat-1', 'Food', 100, -400_00, 9).body).toBe('Over by ₹400 with 9 days to go');
    expect(budgetThreshold('2026-11', 'cat-1', 'Food', 100, 0, 9).body).toBe('Nothing left for the 9 days to go');
  });

  it('celebrates goal milestones', () => {
    expect(goalMilestone('g', 'Phone', '📱', 'saved-50')?.title).toBe('📱 Phone: 50% saved');
    expect(goalMilestone('g', 'Phone', null, 'saved-100')?.title).toBe('🏆 Phone: goal reached!');
    expect(goalMilestone('g', 'Phone', null, 'odd')).toBeNull();
  });
});
