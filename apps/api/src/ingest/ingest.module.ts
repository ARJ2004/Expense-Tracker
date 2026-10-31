import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CategoriesModule } from '../categories';
import { IngestService } from './ingest.service';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerStatsService } from './ledger-stats.service';
import { CategoryDeletedListener } from './listeners/category-deleted.listener';

/** Owns transactions and transaction_sources: IngestService writes, LedgerQueryService and LedgerStatsService read. */
@Module({
  imports: [AccountsModule, CategoriesModule],
  providers: [IngestService, LedgerQueryService, LedgerStatsService, CategoryDeletedListener],
  exports: [IngestService, LedgerQueryService, LedgerStatsService],
})
export class IngestModule {}
