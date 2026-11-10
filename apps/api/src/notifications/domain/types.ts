/** Every kind of notification, grouped as the Settings screen shows them. Each can be switched off. */
export const NOTIFICATION_TYPES = [
  'morning_allowance',
  'daily_summary',
  'weekly_recap',
  'big_spend',
  'over_allowance',
  'budget_threshold',
  'streak_milestone',
  'streak_at_risk',
  'goal_milestone',
  'badge_unlocked',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_GROUPS = ['daily', 'alerts', 'rewards'] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

export const NOTIFICATION_INFO: Record<NotificationType, { group: NotificationGroup; label: string; description: string }> = {
  morning_allowance: { group: 'daily', label: 'Morning allowance', description: '9 am: what you can spend today' },
  daily_summary: { group: 'daily', label: 'Evening summary', description: "9 pm: today's spend against your allowance" },
  weekly_recap: { group: 'daily', label: 'Weekly recap', description: 'Sunday evening: your week in one line' },
  big_spend: { group: 'alerts', label: 'Big spends', description: 'A payment much bigger than usual' },
  over_allowance: { group: 'alerts', label: 'Over the allowance', description: "When today's spend passes the allowance" },
  budget_threshold: { group: 'alerts', label: 'Budget limits', description: 'A category reaches 80% or 100%' },
  streak_milestone: { group: 'rewards', label: 'Streaks', description: '3, 7, 14 and 30 days within your allowance' },
  streak_at_risk: { group: 'rewards', label: 'Streak reminders', description: '8 pm, when a streak is close to breaking' },
  goal_milestone: { group: 'rewards', label: 'Goal milestones', description: '25%, 50%, 75% and 100% saved' },
  badge_unlocked: { group: 'rewards', label: 'Badges', description: 'When you unlock a badge' },
};

/** What a rule or notice decides to say; the service applies the user's settings and the limits. */
export interface NotificationDraft {
  type: NotificationType;
  /** Same key = same notification: never sent twice ("budget_threshold:2026-11:<category>:80"). */
  dedupKey: string;
  title: string;
  body: string;
  /** Where a tap goes in the app. */
  data?: Record<string, string>;
}
