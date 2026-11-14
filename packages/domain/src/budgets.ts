import { addDays, daysBetween } from './goals';
import { MAX_AMOUNT_PAISE } from './money';
import { shiftMonth } from './months';

/**
 * Budgets and the daily allowance. A budget is a monthly limit for one category that carries over
 * month to month until changed. "Fixed" budgets (rent, EMIs) are money that will go anyway, so
 * the allowance holds them back in full from day one. Everything here is pure and works in IST
 * calendar days ("YYYY-MM-DD") and integer paise.
 */

export const BUDGET_LIMITS = {
  minPaise: 100,
  maxPaise: MAX_AMOUNT_PAISE,
  /** One budget per category; this caps custom-category sprawl. */
  maxBudgets: 60,
} as const;

/** Percent of a budget at which an alert goes out. */
export const BUDGET_ALERT_LEVELS = [80, 100] as const;
export type BudgetAlertLevel = (typeof BUDGET_ALERT_LEVELS)[number];

export type BudgetState = 'ok' | 'warning' | 'over';

/** Days before the month-end projection is trusted (one big day early on would skew it). */
export const PACE_MIN_DAYS = 5;

/** First IST day of a month ("2026-11" → "2026-11-01"). */
export function monthStartDay(month: string): string {
  return `${month}-01`;
}

/** Days in an IST month. */
export function daysInMonth(month: string): number {
  return daysBetween(monthStartDay(month), monthStartDay(shiftMonth(month, 1)));
}

/** Days of the month left on `today`, today included (1 on the last day). */
export function daysLeftInMonth(month: string, today: string): number {
  return Math.max(0, daysBetween(today, monthStartDay(shiftMonth(month, 1))));
}

/** Whole percent used, rounded down so 99.6% isn't shown as 100%. */
export function usedPercent(spentPaise: number, budgetPaise: number): number {
  if (budgetPaise <= 0) return 0;
  return Math.floor((Math.max(0, spentPaise) * 100) / budgetPaise);
}

/** over: spent more than the budget; warning: 80% or more (spending it exactly is still within). */
export function budgetState(spentPaise: number, budgetPaise: number): BudgetState {
  if (spentPaise > budgetPaise) return 'over';
  if (usedPercent(spentPaise, budgetPaise) >= 80) return 'warning';
  return 'ok';
}

/** The highest alert level `after` reached that `before` hadn't; null when none was crossed. */
export function crossedAlertLevel(beforePaise: number, afterPaise: number, budgetPaise: number): BudgetAlertLevel | null {
  let crossed: BudgetAlertLevel | null = null;
  for (const level of BUDGET_ALERT_LEVELS) {
    if (usedPercent(afterPaise, budgetPaise) >= level && usedPercent(beforePaise, budgetPaise) < level) crossed = level;
  }
  return crossed;
}

/**
 * Where spend lands at month end at the current pace (spend ÷ days so far × days in month). Null
 * in the first PACE_MIN_DAYS days, when one big day would make the projection meaningless.
 */
export function projectedMonthSpend(spentPaise: number, month: string, today: string): number | null {
  const elapsed = daysBetween(monthStartDay(month), today) + 1;
  const total = daysInMonth(month);
  if (elapsed < PACE_MIN_DAYS || elapsed > total) return null;
  return Math.round((spentPaise * total) / elapsed);
}

/** How much over the budget the pace points at; 0 when on track or too early to say. */
export function paceOvershoot(spentPaise: number, budgetPaise: number, month: string, today: string): number {
  const projected = projectedMonthSpend(spentPaise, month, today);
  return projected === null ? 0 : Math.max(0, projected - budgetPaise);
}

export interface BudgetLine {
  budgetPaise: number;
  spentPaise: number;
  fixed: boolean;
}

/** Fixed budgets are held back in full, or what was actually spent if that's more. */
export function fixedReserve(lines: readonly BudgetLine[]): number {
  return lines.filter((l) => l.fixed).reduce((sum, l) => sum + Math.max(l.budgetPaise, l.spentPaise), 0);
}

export interface GoalReserveInput {
  /** The goal's planned amount a day (goalProgress().dailyTargetPaise). */
  dailyTargetPaise: number;
  remainingPaise: number;
  startDay: string;
  targetDay: string;
}

/**
 * What an active goal asks for in a month: its daily amount for each saving day of the month
 * (startDay up to the day before targetDay), never more than is left to save.
 */
export function goalMonthReserve(goal: GoalReserveInput, month: string): number {
  const first = maxDay(goal.startDay, monthStartDay(month));
  const end = minDay(goal.targetDay, monthStartDay(shiftMonth(month, 1)));
  const days = Math.max(0, daysBetween(first, end));
  return Math.min(goal.remainingPaise, goal.dailyTargetPaise * days);
}

export type AllowanceBasis = 'income' | 'budgets';

export interface AllowanceInput {
  /** Monthly income from the profile, or the sum of all budgets when there's no income. */
  basePaise: number;
  /** fixedReserve() of the month. */
  fixedReservePaise: number;
  /** Σ goalMonthReserve() of active goals. */
  goalReservePaise: number;
  /** Spend this month before today, outside fixed categories. */
  variableSpentBeforeTodayPaise: number;
  /** Spend today, outside fixed categories. */
  variableSpentTodayPaise: number;
  /** daysLeftInMonth(), today included. */
  daysLeft: number;
}

export interface Allowance {
  /** What can be spent today and still end the month on plan; never negative. */
  allowancePaise: number;
  spentTodayPaise: number;
  /** allowance − spent today; negative when over. */
  leftTodayPaise: number;
  /** Money left for the rest of the month, today included, before today's spend. */
  poolPaise: number;
}

/**
 * The daily allowance: (base − fixed − goal savings − spend before today) ÷ days left, rounded
 * down to a whole rupee. It is worked out from spend before today, so it stays put through the
 * day, and overspending today lowers tomorrow's.
 */
export function dailyAllowance(input: AllowanceInput): Allowance {
  const pool = input.basePaise - input.fixedReservePaise - input.goalReservePaise - input.variableSpentBeforeTodayPaise;
  const days = Math.max(1, input.daysLeft);
  const allowance = pool <= 0 ? 0 : Math.floor(pool / days / 100) * 100;
  return {
    allowancePaise: allowance,
    spentTodayPaise: input.variableSpentTodayPaise,
    leftTodayPaise: allowance - input.variableSpentTodayPaise,
    poolPaise: pool,
  };
}

function maxDay(a: string, b: string): string {
  return a > b ? a : b;
}

function minDay(a: string, b: string): string {
  return a < b ? a : b;
}

/** Every IST day of a month, in order. */
export function monthDays(month: string): string[] {
  const out: string[] = [];
  for (let d = monthStartDay(month), n = daysInMonth(month); out.length < n; d = addDays(d, 1)) out.push(d);
  return out;
}
