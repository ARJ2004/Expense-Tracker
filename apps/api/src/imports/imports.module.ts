import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { CategoriesModule } from '../categories';
import { IngestModule } from '../ingest';
import { ImportParserJob } from './import-parser.job';
import { ImportQueue } from './import-queue';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

/** Statement import (F6): owns statement_imports and import_rows; writes the ledger via IngestService. */
@Module({
  imports: [AccountsModule, CategoriesModule, IngestModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportQueue, ImportParserJob],
})
export class ImportsModule {}
