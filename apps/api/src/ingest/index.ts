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
export { LedgerQueryService, type ExportRow } from './ledger-query.service';
export {
  LedgerStatsService,
  TREND_BUCKETS,
  type CategorySpend,
  type MerchantSpend,
  type MonthTotals,
  type TrendBucket,
  type TrendPoint,
} from './ledger-stats.service';
export { statementRowKey, type SourceInput } from './domain/source-input';
export { CaptureService } from './capture.service';
export * from './dto/ingest-batch.dto';
export * from './dto/source-stats.dto';
export * from './dto/transaction.dto';
export * from './ingest.events';
