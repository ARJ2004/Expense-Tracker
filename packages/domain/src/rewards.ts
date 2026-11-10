import { addDays } from './goals';

/**
 * Gamification: the under-budget streak and badges. A day is "under budget" when what was spent
 * that day (outside fixed categories) stayed within that day's allowance. Days are closed once,
 * just after midnight IST, and the record is kept, so a later budget change never rewrites history.
 */

/** Streak lengths that earn a push and a badge. */
export const SPEND_STREAK_MILESTONES = [3, 7, 14, 30] as const;

export interface DayOutcome {
  day: string;
  allowancePaise: number;
  spentPaise: number;
}

/** Within the allowance. A day with no allowance (no income or budgets yet) never counts. */
export function isUnderBudget(o: DayOutcome): boolean {
  return o.allowancePaise > 0 && o.spentPaise <= o.allowancePaise;
}

export interface SpendStreak {
  /** Under-budget days in a row, ending yesterday (today isn't closed yet). */
  current: number;
  best: number;
}

/**
 * The streak as of `today`: consecutive closed days, ending yesterday, that were under budget.
 * A day with no record breaks it, as does a day over budget.
 */
export function spendStreak(outcomes: readonly DayOutcome[], today: string): SpendStreak {
  const byDay = new Map(outcomes.map((o) => [o.day, o]));
  let current = 0;
  for (let day = addDays(today, -1); ; day = addDays(day, -1)) {
    const o = byDay.get(day);
    if (!o || !isUnderBudget(o)) break;
    current++;
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const o of [...outcomes].sort((a, b) => (a.day < b.day ? -1 : 1))) {
    const consecutive = prev !== null && addDays(prev, 1) === o.day;
    run = isUnderBudget(o) ? (consecutive ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    prev = o.day;
  }
  return { current, best: Math.max(best, current) };
}

export const BADGE_CODES = [
  'first_budget',
  'first_goal',
  'goal_reached',
  'no_spend_day',
  'streak_3',
  'streak_7',
  'streak_14',
  'streak_30',
  'month_under_budget',
] as const;
export type BadgeCode = (typeof BADGE_CODES)[number];

export interface BadgeInfo {
  code: BadgeCode;
  emoji: string;
  title: string;
  description: string;
}

/** Shown in the app and in the "Badge unlocked" push; the order is the order on the badges screen. */
export const BADGES: Record<BadgeCode, BadgeInfo> = {
  first_budget: { code: 'first_budget', emoji: '🎯', title: 'Planner', description: 'Set your first budget' },
  first_goal: { code: 'first_goal', emoji: '🌱', title: 'Saver', description: 'Started saving for a goal' },
  goal_reached: { code: 'goal_reached', emoji: '🏆', title: 'Goal getter', description: 'Reached a savings goal' },
  no_spend_day: { code: 'no_spend_day', emoji: '🧘', title: 'No-spend day', description: 'A whole day without spending' },
  streak_3: { code: 'streak_3', emoji: '🔥', title: '3-day streak', description: '3 days in a row within your allowance' },
  streak_7: { code: 'streak_7', emoji: '⚡', title: 'Week under budget', description: '7 days in a row within your allowance' },
  streak_14: { code: 'streak_14', emoji: '💪', title: '2-week streak', description: '14 days in a row within your allowance' },
  streak_30: { code: 'streak_30', emoji: '👑', title: '30-day streak', description: '30 days in a row within your allowance' },
  month_under_budget: { code: 'month_under_budget', emoji: '📅', title: 'Month on budget', description: 'Finished a month within your budgets' },
};

/** The streak badge earned at exactly this length, if any. */
export function streakBadge(length: number): BadgeCode | null {
  return (SPEND_STREAK_MILESTONES as readonly number[]).includes(length) ? (`streak_${length}` as BadgeCode) : null;
}
