import { cell, headerKey } from '../cells';
import { findAccountLast4, findHeaderRow, readRows } from '../table';
import type { ParsedStatement, Sheet, StatementAdapter } from '../types';

/**
 * HDFC Bank savings / current account statement (NetBanking "Download" as XLS or delimited).
 * Header: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance,
 * a row of asterisks under it, and a "STATEMENT SUMMARY" block at the end.
 */
export class HdfcAdapter implements StatementAdapter {
  readonly id = 'hdfc';

  detect(sheet: Sheet): boolean {
    return this.headerIndex(sheet) >= 0;
  }

  parse(sheet: Sheet): ParsedStatement {
    const found = findHeaderRow(sheet);
    if (!found) return { adapter: this.id, bank: 'HDFC Bank', rows: [], skipped: 0 };
    const { rows, skipped } = readRows(sheet, found.index, found.columns, isFooter);
    const accountLast4 = findAccountLast4(sheet, found.index);
    return { adapter: this.id, bank: 'HDFC Bank', ...(accountLast4 ? { accountLast4 } : {}), rows, skipped };
  }

  private headerIndex(sheet: Sheet): number {
    return sheet.slice(0, 40).findIndex((row) => {
      const keys = row.map(headerKey);
      return keys.some((k) => k.includes('narration')) && keys.some((k) => /^value (dat|dt)/.test(k)) && keys.some((k) => k.includes('closing balance'));
    });
  }
}

function isFooter(row: readonly string[]): boolean {
  const first = row.map(cell).find(Boolean)?.toUpperCase() ?? '';
  return first.startsWith('STATEMENT SUMMARY') || first.startsWith('OPENING BALANCE') || first.startsWith('GENERATED ON');
}
