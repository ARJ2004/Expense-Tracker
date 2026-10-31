import type { Sheet, StatementAdapter } from '../types';
import { AxisAdapter } from './axis.adapter';
import { GenericColumnsAdapter } from './generic.adapter';
import { HdfcAdapter } from './hdfc.adapter';
import { IciciAdapter } from './icici.adapter';
import { SbiAdapter } from './sbi.adapter';

export { AxisAdapter, GenericColumnsAdapter, HdfcAdapter, IciciAdapter, SbiAdapter };

/** Checked in order; the generic fallback goes last. */
export const statementAdapters: readonly StatementAdapter[] = [new HdfcAdapter(), new SbiAdapter(), new IciciAdapter(), new AxisAdapter(), new GenericColumnsAdapter()];

export function pickStatementAdapter(sheet: Sheet, fileName = ''): StatementAdapter | undefined {
  return statementAdapters.find((adapter) => adapter.detect(sheet, fileName));
}
