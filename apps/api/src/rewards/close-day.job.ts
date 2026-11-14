import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { addDays, istDateKey } from '@et/domain';
import { JobQueue } from '../common';
import { schedulesEnabled } from '../config/schedules';
import { RewardsService } from './rewards.service';

export const CLOSE_DAY = 'rewards-close-day';

/**
 * Closes yesterday at 08:30 IST: late enough that its pushes (streak milestones, badges) don't
 * land in quiet hours, and spend after midnight belongs to today anyway.
 */
@Injectable()
export class CloseDayJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(CloseDayJob.name);

  constructor(
    private readonly jobs: JobQueue,
    private readonly rewards: RewardsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!schedulesEnabled()) return;
    await this.jobs.schedule(CLOSE_DAY, '30 8 * * *');
    await this.jobs.work(CLOSE_DAY, { pollingIntervalSeconds: 30 }, async () => {
      const yesterday = addDays(istDateKey(new Date()), -1);
      this.logger.log(`closing ${yesterday}`);
      await this.rewards.closeDayForAll(yesterday);
    });
  }
}
