import { Module } from '@nestjs/common';
import { IngestModule } from '../ingest';
import { TransactionsController } from './transactions.controller';

@Module({ imports: [IngestModule], controllers: [TransactionsController] })
export class TransactionsModule {}
