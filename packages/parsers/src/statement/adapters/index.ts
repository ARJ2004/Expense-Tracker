import type { Sheet, StatementAdapter } from '../types';
import { GenericColumnsAdapter } from './generic.adapter';
import { HdfcAdapter } from './hdfc.adapter';

export { GenericColumnsAdapter, HdfcAdapter };

/** Checked in order; the generic fallback goes last. */
export const statementAdapters: readonly StatementAdapter[] = [new HdfcAdapter(), new GenericColumnsAdapter()];

export function pickStatementAdapter(sheet: Sheet, fileName = ''): StatementAdapter | undefined {
  return statementAdapters.find((adapter) => adapter.detect(sheet, fileName));
}
