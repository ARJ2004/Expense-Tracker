import {
  budgetState,
  crossedAlertLevel,
  dailyAllowance,
  daysInMonth,
  daysLeftInMonth,
  fixedReserve,
  goalMonthReserve,
  monthDays,
  paceOvershoot,
  projectedMonthSpend,
  usedPercent,
} from './budgets';
import { isUnderBudget, spendStreak, streakBadge } from './rewards';

describe('month days', () => {
  it('knows month lengths, leap years included', () => {
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(monthDays('2026-02')).toHaveLength(28);
  });

  it('counts today among the days left', () => {
    expect(daysLeftInMonth('2026-11', '2026-11-01')).toBe(30);
    expect(daysLeftInMonth('2026-11', '2026-11-30')).toBe(1);
  });
});

describe('budget state and alerts', () => {
  it('rounds the percent down and turns warning at 80, over only past the budget', () => {
    expect(usedPercent(7_999, 10_000)).toBe(79);
    expect(budgetState(7_999, 10_000)).toBe('ok');
    expect(budgetState(8_000, 10_000)).toBe('warning');
    expect(budgetState(10_000, 10_000)).toBe('warning');
    expect(budgetState(10_001, 10_000)).toBe('over');
    expect(usedPercent(-500, 10_000)).toBe(0);
  });

  it('reports only the highest level newly crossed', () => {
    expect(crossedAlertLevel(7_000, 8_500, 10_000)).toBe(80);
    expect(crossedAlertLevel(7_000, 12_000, 10_000)).toBe(100);
    expect(crossedAlertLevel(8_500, 9_000, 10_000)).toBeNull();
    expect(crossedAlertLevel(12_000, 8_000, 10_000)).toBeNull();
  });

  it('projects month-end spend only after the first few days', () => {
    expect(projectedMonthSpend(1_000_00, '2026-11', '2026-11-03')).toBeNull();
    expect(projectedMonthSpend(1_000_00, '2026-11', '2026-11-10')).toBe(3_000_00);
    expect(paceOvershoot(1_000_00, 2_500_00, '2026-11', '2026-11-10')).toBe(500_00);
    expect(paceOvershoot(1_000_00, 5_000_00, '2026-11', '2026-11-10')).toBe(0);
  });
});

describe('daily allowance', () => {
  it('holds back fixed budgets in full, or their spend if more', () => {
    expect(
      fixedReserve([
        { budgetPaise: 15_000_00, spentPaise: 0, fixed: true },
        { budgetPaise: 5_000_00, spentPaise: 6_000_00, fixed: true },
        { budgetPaise: 8_000_00, spentPaise: 9_000_00, fixed: false },
      ]),
    ).toBe(21_000_00);
  });

  it('counts a goal only for its saving days in the month, capped at what is left', () => {
    const goal = { dailyTargetPaise: 500_00, remainingPaise: 50_000_00, startDay: '2026-11-11', targetDay: '2027-02-01' };
    expect(goalMonthReserve(goal, '2026-11')).toBe(20 * 500_00);
    expect(goalMonthReserve(goal, '2026-12')).toBe(31 * 500_00);
    expect(goalMonthReserve({ ...goal, remainingPaise: 1_000_00 }, '2026-12')).toBe(1_000_00);
    expect(goalMonthReserve(goal, '2027-03')).toBe(0);
  });

  it('spreads what is left over the days left, in whole rupees', () => {
    const a = dailyAllowance({
      basePaise: 75_000_00,
      fixedReservePaise: 20_000_00,
      goalReservePaise: 15_000_00,
      variableSpentBeforeTodayPaise: 14_000_00,
      variableSpentTodayPaise: 300_00,
      daysLeft: 20,
    });
    expect(a.poolPaise).toBe(26_000_00);
    expect(a.allowancePaise).toBe(1_300_00);
    expect(a.leftTodayPaise).toBe(1_000_00);
    expect(Number.isInteger(dailyAllowance({ basePaise: 10_000_01, fixedReservePaise: 0, goalReservePaise: 0, variableSpentBeforeTodayPaise: 0, variableSpentTodayPaise: 0, daysLeft: 7 }).allowancePaise / 100)).toBe(true);
  });

  it('is zero, never negative, once the month is overspent', () => {
    const a = dailyAllowance({ basePaise: 10_000_00, fixedReservePaise: 0, goalReservePaise: 0, variableSpentBeforeTodayPaise: 12_000_00, variableSpentTodayPaise: 200_00, daysLeft: 5 });
    expect(a.allowancePaise).toBe(0);
    expect(a.leftTodayPaise).toBe(-200_00);
  });
});

describe('spend streak', () => {
  const day = (d: string, spent: number, allowance = 1_000_00) => ({ day: d, allowancePaise: allowance, spentPaise: spent });

  it('counts closed days in a row ending yesterday', () => {
    const outcomes = [day('2026-11-07', 2_000_00), day('2026-11-08', 500_00), day('2026-11-09', 0), day('2026-11-10', 1_000_00)];
    expect(spendStreak(outcomes, '2026-11-11')).toEqual({ current: 3, best: 3 });
  });

  it('breaks on a missing day or a day over, and keeps the best run', () => {
    const outcomes = [day('2026-11-01', 0), day('2026-11-02', 0), day('2026-11-03', 0), day('2026-11-04', 0), day('2026-11-06', 0)];
    expect(spendStreak(outcomes, '2026-11-07')).toEqual({ current: 1, best: 4 });
    expect(spendStreak(outcomes, '2026-11-09').current).toBe(0);
  });

  it('never counts a day with no allowance', () => {
    expect(isUnderBudget(day('2026-11-01', 0, 0))).toBe(false);
  });

  it('names the badge for milestone lengths only', () => {
    expect(streakBadge(7)).toBe('streak_7');
    expect(streakBadge(8)).toBeNull();
  });
});
