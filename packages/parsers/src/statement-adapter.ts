import type { NormalizedTxn } from '@et/domain';

/** The first rows of an uploaded statement plus its header, used to pick an adapter. */
export interface StatementSample {
  fileName: string;
  headers: string[];
  rows: string[][];
}

/** One parsed row before normalization: header name → cell text. */
export type RawRow = Record<string, string>;

/**
 * One implementation per bank, plus a generic fallback that finds columns by name.
 * Adding a bank means adding one adapter and registering it; shared code never branches on bank.
 */
export interface StatementAdapter {
  id: string;
  detect(sample: StatementSample): boolean;
  parse(rows: RawRow[]): NormalizedTxn[];
}

/** Checked in order; the generic fallback goes last. */
export const statementAdapters: StatementAdapter[] = [];

export function pickStatementAdapter(sample: StatementSample): StatementAdapter | undefined {
  return statementAdapters.find((adapter) => adapter.detect(sample));
}
