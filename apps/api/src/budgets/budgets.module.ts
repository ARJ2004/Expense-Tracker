import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories';
import { GoalsModule } from '../goals';
import { IngestModule } from '../ingest';
import { UsersModule } from '../users';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

/** F10: owns budgets; reads spend from ingest, income from users, goal savings from goals. */
@Module({
  imports: [IngestModule, UsersModule, GoalsModule, CategoriesModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
