import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CategoriesModule } from '../categories';
import { IngestService } from './ingest.service';
import { LedgerQueryService } from './ledger-query.service';
import { CategoryDeletedListener } from './listeners/category-deleted.listener';

/** Owns transactions and transaction_sources: IngestService writes, LedgerQueryService reads. */
@Module({
  imports: [AccountsModule, CategoriesModule],
  providers: [IngestService, LedgerQueryService, CategoryDeletedListener],
  exports: [IngestService, LedgerQueryService],
})
export class IngestModule {}
