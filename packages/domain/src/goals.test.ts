import { addDays, dailyTarget, daysBetween, goalProgress, newMilestones, type GoalContributionDay } from './goals';

const START = '2026-11-01';
const phone = { targetPaise: 50_000_00, startDay: START, targetDay: addDays(START, 90) };
const saved = (days: number[], amount = 556_00): GoalContributionDay[] => days.map((d) => ({ day: addDays(START, d), amountPaise: amount }));

describe('days', () => {
  it('counts whole IST days and adds them across months and leap years', () => {
    expect(daysBetween('2026-11-01', '2027-01-30')).toBe(90);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dailyTarget', () => {
  it('rounds up to a whole rupee, in integer paise', () => {
    expect(dailyTarget(50_000_00, 90)).toBe(556_00);
    expect(dailyTarget(100, 3)).toBe(100);
    expect(dailyTarget(90_000_00, 90)).toBe(1_000_00);
    expect(dailyTarget(99_99_99_99_999, 3650)).toBe(Math.ceil(99_99_99_99_999 / 3650 / 100) * 100);
  });

  it('never asks for more than what is left, nor anything once it is saved', () => {
    expect(dailyTarget(250_00, 1)).toBe(250_00);
    expect(dailyTarget(50, 10)).toBe(50);
    expect(dailyTarget(0, 10)).toBe(0);
  });
});

describe('goalProgress', () => {
  it('starts at ₹556 a day, nothing saved, today pending', () => {
    const p = goalProgress(phone, [], START);
    expect(p).toMatchObject({ savedPaise: 0, remainingPaise: 50_000_00, dailyTargetPaise: 556_00, suggestedTodayPaise: 556_00, daysLeft: 90, daysCloser: 0, daysToGo: 90, scheduleDelta: 0, streak: 0, reached: false, overdue: false });
    expect(p.last14.at(-1)).toEqual({ day: START, status: 'pending' });
    expect(p.last14[0]!.status).toBe('none');
  });

  it('builds a streak one day at a time: "5 days closer, 85 to go"', () => {
    const p = goalProgress(phone, saved([0, 1, 2, 3, 4]), addDays(START, 4));
    expect(p).toMatchObject({ savedPaise: 2_780_00, daysCloser: 5, daysToGo: 85, streak: 5, bestStreak: 5, scheduleDelta: 0 });
    expect(p.milestones).toEqual(['streak-3']);
  });

  it("doesn't break the streak for today before it's saved", () => {
    const p = goalProgress(phone, saved([0, 1, 2]), addDays(START, 3));
    expect(p).toMatchObject({ streak: 3, scheduleDelta: 0 });
    expect(p.last14.at(-1)!.status).toBe('pending');
  });

  it('breaks the streak on a missed day when behind, and asks a little more each day after', () => {
    const p = goalProgress(phone, saved([0, 1, 3]), addDays(START, 3));
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(2);
    expect(p.scheduleDelta).toBe(-1);
    expect(p.last14.slice(-2).map((d) => d.status)).toEqual(['missed', 'met']);

    const behind = goalProgress(phone, saved([0]), addDays(START, 10));
    // ₹49,444 left over 80 days: ₹619 a day to stay on track.
    expect(behind.suggestedTodayPaise).toBe(619_00);
    expect(behind.scheduleDelta).toBe(-9);
  });

  it('keeps the streak when a missed day is covered by being ahead', () => {
    const p = goalProgress(phone, [{ day: START, amountPaise: 2_000_00 }, ...saved([1, 3])], addDays(START, 3));
    expect(p.last14.slice(-3).map((d) => d.status)).toEqual(['met', 'covered', 'met']);
    expect(p.streak).toBe(3);
    expect(p.scheduleDelta).toBeGreaterThan(0);
    expect(p.suggestedTodayPaise).toBe(556_00);
  });

  it('adds several contributions on one day together', () => {
    const p = goalProgress(phone, [{ day: START, amountPaise: 300_00 }, { day: START, amountPaise: 256_00 }], START);
    expect(p).toMatchObject({ savedTodayPaise: 556_00, streak: 1, daysCloser: 1 });
  });

  it('is reached once the target is saved, and celebrates every saved milestone', () => {
    const p = goalProgress(phone, [{ day: START, amountPaise: 50_000_00 }], START);
    expect(p).toMatchObject({ reached: true, remainingPaise: 0, daysLeft: 0, suggestedTodayPaise: 0, scheduleDelta: 0, streak: 1 });
    expect(p.milestones).toEqual(['saved-25', 'saved-50', 'saved-75', 'saved-100']);
  });

  it('is overdue after the deadline without the target', () => {
    const p = goalProgress(phone, saved([0]), phone.targetDay);
    expect(p).toMatchObject({ overdue: true, daysLeft: 0, reached: false, suggestedTodayPaise: 50_000_00 - 556_00 });
  });

  it('asks only what is left on the last day', () => {
    const p = goalProgress({ targetPaise: 1_000_00, startDay: START, targetDay: addDays(START, 3) }, saved([0, 1], 334_00), addDays(START, 2));
    expect(p.suggestedTodayPaise).toBe(332_00);
  });
});

describe('newMilestones', () => {
  it('returns only what a contribution just reached', () => {
    expect(newMilestones(['saved-25'], ['saved-25', 'saved-50', 'streak-3'])).toEqual(['saved-50', 'streak-3']);
  });
});
