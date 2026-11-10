import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets';
import { CloseDayJob } from './close-day.job';
import { RewardsController } from './rewards.controller';
import { RewardsListener } from './rewards.listener';
import { RewardsService } from './rewards.service';

/** Gamification: owns day_outcomes and badges; the streak is built on budgets' daily allowance. */
@Module({
  imports: [BudgetsModule],
  controllers: [RewardsController],
  providers: [RewardsService, RewardsListener, CloseDayJob],
  exports: [RewardsService],
})
export class RewardsModule {}
