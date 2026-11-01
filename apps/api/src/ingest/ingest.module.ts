import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CategoriesModule } from '../categories';
import { CaptureService } from './capture.service';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerStatsService } from './ledger-stats.service';
import { SourceStatsService } from './source-stats.service';
import { CategoryDeletedListener } from './listeners/category-deleted.listener';

/**
 * Owns transactions and transaction_sources: IngestService writes, LedgerQueryService and
 * LedgerStatsService read. POST /v1/ingest/batch takes rows the phone captured (bank SMS);
 * GET /v1/ingest/sources counts what each source added.
 */
@Module({
  imports: [AccountsModule, CategoriesModule],
  controllers: [IngestController],
  providers: [IngestService, CaptureService, LedgerQueryService, LedgerStatsService, SourceStatsService, CategoryDeletedListener],
  exports: [IngestService, LedgerQueryService, LedgerStatsService],
})
export class IngestModule {}
