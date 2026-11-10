import type { NotificationType } from './types';

/** No pushes from 22:00 to 08:00 IST. */
export const QUIET_HOURS = { start: 22, end: 8 } as const;
/** At most this many pushes a day; the evening summary is always allowed on top. */
export const MAX_PUSHES_PER_DAY = 3;

const IST_OFFSET_MS = 330 * 60 * 1000;

export function istHour(now: Date): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
}

export type Verdict = 'send' | 'quiet_hours' | 'daily_cap';

/**
 * Whether a push may go out now. Held ones still land in the in-app inbox, so nothing is lost,
 * the phone just doesn't buzz.
 */
export function pushVerdict(type: NotificationType, now: Date, sentToday: number): Verdict {
  const hour = istHour(now);
  if (hour >= QUIET_HOURS.start || hour < QUIET_HOURS.end) return 'quiet_hours';
  if (type !== 'daily_summary' && sentToday >= MAX_PUSHES_PER_DAY) return 'daily_cap';
  return 'send';
}

/** Big spend: at least twice the usual (median) debit, and at least ₹1,000. Needs 5+ debits of history. */
export const BIG_SPEND = { multiple: 2, minPaise: 1_000_00, minHistory: 5, historyDays: 60 } as const;

export function isBigSpend(amountPaise: number, typical: { medianPaise: number; count: number }): boolean {
  if (typical.count < BIG_SPEND.minHistory) return false;
  return amountPaise >= BIG_SPEND.minPaise && amountPaise >= typical.medianPaise * BIG_SPEND.multiple;
}

/** Streak reminder: a streak of 2+ days and at most this share of today's allowance left. */
export const STREAK_AT_RISK_SHARE = 0.25;
