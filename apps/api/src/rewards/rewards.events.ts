import type { BadgeCode } from '@et/domain';

/** Rewards events, emitted after the write. Notifications listens. */
export const BADGE_UNLOCKED = 'badge.unlocked';

export interface BadgeUnlockedEvent {
  userId: string;
  code: BadgeCode;
}

/** The under-budget streak reached a milestone length (3, 7, 14, 30) when a day was closed. */
export const STREAK_MILESTONE = 'streak.milestone';

export interface StreakMilestoneEvent {
  userId: string;
  length: number;
}
