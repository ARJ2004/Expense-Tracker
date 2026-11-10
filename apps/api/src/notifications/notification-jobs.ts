import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { istDateKey } from '@et/domain';
import { BudgetsService } from '../budgets';
import { JobQueue } from '../common';
import { schedulesEnabled } from '../config/schedules';
import { DevicesService } from './devices.service';
import { NotificationsService } from './notifications.service';
import { SCHEDULED_NOTICES, type ScheduledNotice } from './rules/scheduled-notice';

/** Schedules every ScheduledNotice and runs it for each user with a phone or a plan. */
@Injectable()
export class NotificationJobs implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationJobs.name);

  constructor(
    private readonly jobs: JobQueue,
    private readonly notifications: NotificationsService,
    private readonly devices: DevicesService,
    private readonly budgets: BudgetsService,
    @Inject(SCHEDULED_NOTICES) private readonly notices: ScheduledNotice[],
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!schedulesEnabled()) return;
    for (const notice of this.notices) {
      await this.jobs.schedule(notice.job, notice.cron);
      await this.jobs.work(notice.job, { pollingIntervalSeconds: 30 }, () => this.run(notice.job));
    }
  }

  /** Runs one notice for everyone now; public so tests (and an operator) can trigger it. */
  async run(job: string, userIds?: string[]): Promise<void> {
    const notice = this.notices.find((n) => n.job === job);
    if (!notice) throw new Error(`Unknown notice ${job}`);
    const today = istDateKey(this.notifications.now());
    const audience = userIds ?? [...new Set([...(await this.devices.userIds()), ...(await this.budgets.userIdsWithPlan())])];
    for (const userId of audience) {
      try {
        const draft = await notice.build(userId, today);
        if (draft) await this.notifications.notify(userId, draft);
      } catch (e) {
        this.logger.error(`${job} failed for a user: ${(e as Error).message}`);
      }
    }
  }
}
