import { findHeaderRow, firstCell, readStatement } from '../table';
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
    return readStatement(sheet, { adapter: this.id, isFooter });
  }
}

function isFooter(row: readonly string[]): boolean {
  return /^(STATEMENT SUMMARY|OPENING BALANCE|CLOSING BALANCE|TOTAL|GRAND TOTAL|\*\*END)/.test(firstCell(row));
}
