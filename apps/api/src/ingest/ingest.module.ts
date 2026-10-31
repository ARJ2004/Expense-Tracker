import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CategoriesModule } from '../categories';
import { CaptureService } from './capture.service';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerStatsService } from './ledger-stats.service';
import { CategoryDeletedListener } from './listeners/category-deleted.listener';

/**
 * Owns transactions and transaction_sources: IngestService writes, LedgerQueryService and
 * LedgerStatsService read. POST /v1/ingest/batch takes rows the phone captured (bank SMS).
 */
@Module({
  imports: [AccountsModule, CategoriesModule],
  controllers: [IngestController],
  providers: [IngestService, CaptureService, LedgerQueryService, LedgerStatsService, CategoryDeletedListener],
  exports: [IngestService, LedgerQueryService, LedgerStatsService],
})
export class IngestModule {}
