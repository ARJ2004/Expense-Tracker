import { MAX_AMOUNT_PAISE } from './money';

/**
 * Savings goals: "₹50,000 for a phone in 3 months" becomes ₹556 a day, a streak for each day
 * that amount is put aside, and "12 days closer". Everything here is worked out from the goal and
 * its contributions, never stored, so the API and the app always agree. Days are IST calendar
 * days ("YYYY-MM-DD"); amounts are integer paise.
 */

export const GOAL_LIMITS = {
  nameLength: { min: 1, max: 60 },
  minTargetPaise: 100,
  maxTargetPaise: MAX_AMOUNT_PAISE,
  /** The deadline is at least tomorrow and at most this many days away. */
  maxDays: 3650,
  maxActiveGoals: 10,
} as const;

/** Percent saved and streak lengths worth celebrating. */
export const SAVED_MILESTONES = [25, 50, 75, 100] as const;
export const STREAK_MILESTONES = [3, 7, 30] as const;

export interface GoalPlan {
  targetPaise: number;
  /** The IST day the goal was set. */
  startDay: string;
  /** The IST day it is wanted by; saving days are startDay up to the day before. */
  targetDay: string;
}

export interface GoalContributionDay {
  day: string;
  amountPaise: number;
}

/**
 * How one day went. "met": saved at least that day's amount. "covered": missed, but already ahead
 * of plan, so the streak carries on. "missed": breaks the streak. "pending": today, not saved yet.
 * "none": before the goal started.
 */
export type GoalDayStatus = 'met' | 'covered' | 'missed' | 'pending' | 'none';

export interface GoalProgress {
  savedPaise: number;
  remainingPaise: number;
  /** The plan: target ÷ saving days, rounded up to a whole rupee. */
  dailyTargetPaise: number;
  /** What to put aside today to stay on plan (more when behind), never more than what's left. */
  suggestedTodayPaise: number;
  savedTodayPaise: number;
  /** Saving days left, today included; 0 on and after the deadline. */
  daysLeft: number;
  /** Days of saving already done: saved ÷ daily amount. "12 days closer". */
  daysCloser: number;
  /** Days of saving still needed at the daily amount. "78 to go". */
  daysToGo: number;
  /** Days ahead of plan (positive) or behind (negative). */
  scheduleDelta: number;
  streak: number;
  bestStreak: number;
  reached: boolean;
  /** The deadline came and the target wasn't reached. */
  overdue: boolean;
  /** Ids such as "saved-50" and "streak-7", in the order they were reached. */
  milestones: string[];
  last14: { day: string; status: GoalDayStatus }[];
}

const DAY_MS = 86_400_000;

/** Whole days from a to b ("2026-11-01" → "2026-11-04" is 3). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** The IST day `n` days after `day`. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** a ÷ b rounded up, in integers. */
function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

/** Paise rounded up to a whole rupee: ₹555.56 a day is asked as ₹556. */
function upToRupee(p: number): number {
  return ceilDiv(p, 100) * 100;
}

/** The daily amount for `remainingPaise` over `days` saving days. */
export function dailyTarget(remainingPaise: number, days: number): number {
  if (remainingPaise <= 0) return 0;
  return Math.min(remainingPaise, upToRupee(ceilDiv(remainingPaise, Math.max(1, days))));
}

export function goalProgress(goal: GoalPlan, contributions: readonly GoalContributionDay[], today: string): GoalProgress {
  const totalDays = Math.max(1, daysBetween(goal.startDay, goal.targetDay));
  const daily = dailyTarget(goal.targetPaise, totalDays);

  const byDay = new Map<string, number>();
  for (const c of contributions) byDay.set(c.day, (byDay.get(c.day) ?? 0) + c.amountPaise);
  const saved = Math.max(0, [...byDay.values()].reduce((a, b) => a + b, 0));
  const savedToday = byDay.get(today) ?? 0;
  const remaining = Math.max(0, goal.targetPaise - saved);
  const reached = saved >= goal.targetPaise;

  // One pass from the start to today: each day met, covered by being ahead, or missed.
  const status = new Map<string, GoalDayStatus>();
  let cumulative = 0;
  let run = 0;
  let best = 0;
  const lastDay = daysBetween(goal.startDay, today) < 0 ? null : today;
  for (let day = goal.startDay; lastDay !== null && day <= lastDay; day = addDays(day, 1)) {
    const before = cumulative;
    const onDay = byDay.get(day) ?? 0;
    cumulative += onDay;
    if (before >= goal.targetPaise) break;
    const need = Math.min(daily, goal.targetPaise - before);
    const planThrough = Math.min(goal.targetPaise, daily * (daysBetween(goal.startDay, day) + 1));
    let s: GoalDayStatus;
    if (onDay >= need) s = 'met';
    else if (day === today) s = 'pending';
    else if (cumulative >= planThrough) s = 'covered';
    else s = 'missed';
    status.set(day, s);
    if (s === 'met') run++;
    else if (s === 'missed') run = 0;
    best = Math.max(best, run);
  }

  const savingDayIndex = daysBetween(goal.startDay, today);
  const daysLeft = reached ? 0 : Math.max(0, daysBetween(today, goal.targetDay));
  const remainingBeforeToday = Math.max(0, goal.targetPaise - (saved - savedToday));
  const catchUp = daysLeft > 0 ? dailyTarget(remainingBeforeToday, daysLeft) : remainingBeforeToday;
  const suggestedToday = reached ? 0 : Math.min(remainingBeforeToday, Math.max(daily, catchUp));

  const daysCloser = daily > 0 ? Math.floor(saved / daily) : 0;
  const daysToGo = daily > 0 ? ceilDiv(remaining, daily) : 0;
  // Days the plan expects by now: those before today, and today too once it's done.
  const todayDone = status.get(today) === 'met';
  const expected = Math.min(totalDays, Math.max(0, savingDayIndex) + (todayDone ? 1 : 0));
  const scheduleDelta = reached ? 0 : daysCloser - expected;

  const milestones: string[] = [];
  for (const p of SAVED_MILESTONES) if (saved * 100 >= goal.targetPaise * p) milestones.push(`saved-${p}`);
  for (const n of STREAK_MILESTONES) if (best >= n) milestones.push(`streak-${n}`);

  const last14: GoalProgress['last14'] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    last14.push({ day, status: status.get(day) ?? 'none' });
  }

  return {
    savedPaise: saved,
    remainingPaise: remaining,
    dailyTargetPaise: daily,
    suggestedTodayPaise: suggestedToday,
    savedTodayPaise: savedToday,
    daysLeft,
    daysCloser,
    daysToGo,
    scheduleDelta,
    streak: run,
    bestStreak: best,
    reached,
    overdue: !reached && daysBetween(today, goal.targetDay) <= 0,
    milestones,
    last14,
  };
}

/** Milestones in `after` that weren't in `before`: what to celebrate after a contribution. */
export function newMilestones(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((m) => !before.includes(m));
}
