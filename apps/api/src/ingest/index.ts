export { IngestModule } from './ingest.module';
export {
  IngestService,
  type BatchItem,
  type BatchOptions,
  type BatchResult,
  type DryRunRow,
  type IngestItem,
  type IngestResult,
  type RecategorizeResult,
  type TransactionPatch,
} from './ingest.service';
export type { CategoryHit, DedupMatch } from './domain/pipeline';
export { LedgerQueryService } from './ledger-query.service';
export { statementRowKey, type SourceInput } from './domain/source-input';
export * from './dto/transaction.dto';
export * from './ingest.events';
