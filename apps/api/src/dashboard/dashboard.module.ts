import { Module } from '@nestjs/common';
import { IngestModule } from '../ingest';
import { UsersModule } from '../users';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** F7, read-only: aggregates come from ingest's LedgerStatsService, income from UsersService. */
@Module({ imports: [IngestModule, UsersModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
