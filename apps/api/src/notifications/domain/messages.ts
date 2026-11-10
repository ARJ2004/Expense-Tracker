import { BADGES, formatINR, type BadgeCode } from '@et/domain';
import type { NotificationDraft } from './types';

/** The words of every notification, in one place, pure. Amounts come in paise. */
/** Whole rupees, no sign: "₹1,240". */
const inr = (paise: number) => formatINR(Math.round(Math.abs(paise) / 100) * 100, { decimals: 'auto' });

export function morningAllowance(day: string, allowancePaise: number, streak: number): NotificationDraft {
  const fire = streak >= 2 ? ` · 🔥 ${streak}-day streak` : '';
  return {
    type: 'morning_allowance',
    dedupKey: `morning_allowance:${day}`,
    title: `You can spend ${inr(allowancePaise)} today`,
    body: `Stay within it to keep the month on plan${fire}`,
    data: { screen: 'Budgets' },
  };
}

export function dailySummary(day: string, spentPaise: number, allowancePaise: number | null): NotificationDraft {
  const base = { type: 'daily_summary' as const, dedupKey: `daily_summary:${day}`, data: { screen: 'Home' } };
  if (allowancePaise === null) return { ...base, title: `Today you spent ${inr(spentPaise)}`, body: 'Tap to see where it went' };
  if (spentPaise === 0) return { ...base, title: 'A no-spend day 🧘', body: `Your ${inr(allowancePaise)} allowance rolls into the rest of the month` };
  const left = allowancePaise - spentPaise;
  if (left >= 0) return { ...base, title: `Today ${inr(spentPaise)} · ${inr(left)} under 🎯`, body: 'Within your allowance. Nice.' };
  return { ...base, title: `Today ${inr(spentPaise)} · ${inr(left)} over`, body: "Tomorrow's allowance is a little lower to make up for it" };
}

export function weeklyRecap(weekStart: string, spentPaise: number, top: { name: string; paise: number } | null, under: { under: number; closed: number }): NotificationDraft {
  const days = under.closed > 0 ? ` ${under.under} of ${under.closed} days within your allowance.` : '';
  const biggest = top ? ` ${top.name} was the biggest at ${inr(top.paise)}.` : '';
  return {
    type: 'weekly_recap',
    dedupKey: `weekly_recap:${weekStart}`,
    title: `This week: ${inr(spentPaise)}`,
    body: `${biggest}${days}`.trim() || 'Tap for your week',
    data: { screen: 'Home' },
  };
}

export function bigSpend(transactionId: string, amountPaise: number, merchant: string | null): NotificationDraft {
  return {
    type: 'big_spend',
    dedupKey: `big_spend:${transactionId}`,
    title: `${inr(amountPaise)}${merchant ? ` at ${merchant}` : ''}`,
    body: 'Bigger than your usual spend. Tap to check it',
    data: { screen: 'Transaction', id: transactionId },
  };
}

export function overAllowance(day: string, overPaise: number, tomorrowHint: boolean): NotificationDraft {
  return {
    type: 'over_allowance',
    dedupKey: `over_allowance:${day}`,
    title: `${inr(overPaise)} over today's allowance`,
    body: tomorrowHint ? "Tomorrow's allowance will be a little lower" : 'Tap to see today',
    data: { screen: 'Budgets' },
  };
}

export function budgetThreshold(month: string, categoryId: string, categoryName: string, level: 80 | 100, leftPaise: number, daysLeft: number): NotificationDraft {
  return {
    type: 'budget_threshold',
    dedupKey: `budget_threshold:${month}:${categoryId}:${level}`,
    title: level === 100 ? `${categoryName} budget used up` : `${categoryName} is at 80%`,
    body:
      level === 80
        ? `${inr(leftPaise)} left for ${daysLeft} days`
        : leftPaise < 0
          ? `Over by ${inr(-leftPaise)} with ${daysLeft} days to go`
          : `Nothing left for the ${daysLeft} days to go`,
    data: { screen: 'Budgets' },
  };
}

export function streakMilestone(day: string, length: number): NotificationDraft {
  return {
    type: 'streak_milestone',
    dedupKey: `streak_milestone:${day}:${length}`,
    title: `🔥 ${length}-day streak!`,
    body: `${length} days in a row within your allowance. Keep it going today`,
    data: { screen: 'Rewards' },
  };
}

export function streakAtRisk(day: string, streak: number, leftPaise: number): NotificationDraft {
  return {
    type: 'streak_at_risk',
    dedupKey: `streak_at_risk:${day}`,
    title: `Your ${streak}-day streak is on the line`,
    body: `${inr(leftPaise)} left in today's allowance`,
    data: { screen: 'Budgets' },
  };
}

export function goalMilestone(goalId: string, name: string, emoji: string | null, milestone: string): NotificationDraft | null {
  const [kind, n] = milestone.split('-');
  const label = emoji ? `${emoji} ${name}` : name;
  const base = { type: 'goal_milestone' as const, dedupKey: `goal_milestone:${goalId}:${milestone}`, data: { screen: 'Goal', id: goalId } };
  if (kind === 'saved' && n === '100') return { ...base, title: `🏆 ${label}: goal reached!`, body: 'You saved every rupee of it' };
  if (kind === 'saved') return { ...base, title: `${label}: ${n}% saved`, body: 'Keep the daily amount going' };
  if (kind === 'streak') return { ...base, title: `${label}: ${n}-day saving streak`, body: 'You saved every day. Well done' };
  return null;
}

export function badgeUnlocked(code: BadgeCode): NotificationDraft {
  const b = BADGES[code];
  return {
    type: 'badge_unlocked',
    dedupKey: `badge_unlocked:${code}`,
    title: `${b.emoji} Badge unlocked: ${b.title}`,
    body: b.description,
    data: { screen: 'Rewards' },
  };
}
