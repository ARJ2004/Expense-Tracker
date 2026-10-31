import { cell } from '../cells';
import { findAccountLast4, findHeaderRow, readRows } from '../table';
import type { ParsedStatement, Sheet, StatementAdapter } from '../types';

/**
 * Fallback for any bank: finds a header row with a date, a narration and debit/credit (or
 * amount + Dr/Cr) columns by common names, and reads rows below it.
 */
export class GenericColumnsAdapter implements StatementAdapter {
  readonly id = 'generic';

  detect(sheet: Sheet): boolean {
    return findHeaderRow(sheet) !== null;
  }

  parse(sheet: Sheet): ParsedStatement {
    const found = findHeaderRow(sheet);
    if (!found) return { adapter: this.id, rows: [], skipped: 0 };
    const { rows, skipped } = readRows(sheet, found.index, found.columns, isFooter);
    const accountLast4 = findAccountLast4(sheet, found.index);
    return { adapter: this.id, ...(accountLast4 ? { accountLast4 } : {}), rows, skipped };
  }
}

function isFooter(row: readonly string[]): boolean {
  const first = row.map(cell).find(Boolean)?.toUpperCase() ?? '';
  return /^(STATEMENT SUMMARY|OPENING BALANCE|CLOSING BALANCE|TOTAL|GRAND TOTAL|\*\*END)/.test(first);
}
