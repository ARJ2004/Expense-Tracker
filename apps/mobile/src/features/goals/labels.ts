import type { Goal, GoalProgress } from '@et/api-client';
import { formatINR, formatISTDate } from '@et/domain';

/** Deadline quick picks, in days, so "3 months" is the 90 days people expect. */
export const DEADLINE_OPTIONS = [
  { value: '30', label: '1 month' },
  { value: '60', label: '2 months' },
  { value: '90', label: '3 months' },
  { value: '180', label: '6 months' },
  { value: '365', label: '1 year' },
  { value: '730', label: '2 years' },
] as const;

export const EMOJI_OPTIONS = ['📱', '💻', '✈️', '🏍️', '🎁', '🏠', '🎓', '💍', '🎧', '⌚'] as const;

const plural = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

/** ₹556 (whole rupees, as the daily amount always is). */
export function rupees(paise: number): string {
  return formatINR(paise, { decimals: 'auto' });
}

/** "12 days closer · 78 to go", or how to start on day one. */
export function closerLabel(p: GoalProgress): string {
  if (p.reached) return 'Goal reached';
  if (p.daysCloser === 0) return `Save ${rupees(p.dailyTargetPaise)} a day to get there`;
  return `${plural(p.daysCloser, 'day')} closer · ${p.daysToGo.toLocaleString('en-IN')} to go`;
}

/** "On track", "3 days ahead", "2 days behind · ₹619 a day to catch up", or the deadline passed. */
export function scheduleLabel(goal: Pick<Goal, 'targetDay' | 'reachedAt'>, p: GoalProgress): string {
  if (p.reached) return goal.reachedAt ? `Reached on ${formatISTDate(new Date(goal.reachedAt))}` : 'Reached';
  if (p.overdue) return `The date passed with ${rupees(p.remainingPaise)} to go`;
  if (p.scheduleDelta > 0) return `${plural(p.scheduleDelta, 'day')} ahead`;
  if (p.scheduleDelta < 0) {
    const catchUp = p.suggestedTodayPaise > p.dailyTargetPaise ? ` · ${rupees(p.suggestedTodayPaise)} a day to catch up` : '';
    return `${plural(-p.scheduleDelta, 'day')} behind${catchUp}`;
  }
  return 'On track';
}

/** "🔥 5-day streak", or nothing to show yet. */
export function streakLabel(streak: number): string | null {
  return streak > 0 ? `🔥 ${streak}-day streak` : null;
}

/** The preview on the new-goal screen: "₹556 a day for 90 days · until 30 Jan 2027". */
export function planLabel(dailyPaise: number, days: number, until: Date): string {
  return `${rupees(dailyPaise)} a day for ${plural(days, 'day')} · until ${formatISTDate(until, { year: true })}`;
}

/** What each milestone says when it is reached. */
export const MILESTONE_COPY: Record<string, { emoji: string; title: string }> = {
  'saved-25': { emoji: '🌱', title: 'A quarter of the way there' },
  'saved-50': { emoji: '⛰️', title: 'Halfway there' },
  'saved-75': { emoji: '🚀', title: 'Three quarters saved' },
  'saved-100': { emoji: '🎉', title: 'Goal reached!' },
  'streak-3': { emoji: '🔥', title: '3 days in a row' },
  'streak-7': { emoji: '🔥', title: 'A whole week in a row' },
  'streak-30': { emoji: '🏆', title: '30 days in a row' },
};

/** The one to celebrate when a contribution reaches several: reaching the goal beats the rest. */
export function headlineMilestone(milestones: readonly string[]): string | null {
  if (milestones.includes('saved-100')) return 'saved-100';
  return milestones.filter((m) => MILESTONE_COPY[m]).at(-1) ?? null;
}
