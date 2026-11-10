import type { NotificationDraft } from '../domain/types';

/**
 * A notification built on a schedule (cron in IST) for each user. Adding one = one class here and
 * registering it in SCHEDULED_NOTICES; the jobs runner needs no change.
 */
export interface ScheduledNotice {
  /** pg-boss queue name. */
  readonly job: string;
  readonly cron: string;
  build(userId: string, today: string): Promise<NotificationDraft | null>;
}

export const SCHEDULED_NOTICES = Symbol('SCHEDULED_NOTICES');
