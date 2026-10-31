import { headerKey } from '../cells';
import { firstCell, readStatement } from '../table';
import type { ParsedStatement, Sheet, StatementAdapter } from '../types';

/**
 * HDFC Bank savings / current account statement (NetBanking "Download" as XLS or delimited).
 * Header: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance,
 * a row of asterisks under it, and a "STATEMENT SUMMARY" block at the end.
 */
export class HdfcAdapter implements StatementAdapter {
  readonly id = 'hdfc';

  detect(sheet: Sheet): boolean {
    return sheet.slice(0, 40).some((row) => {
      const keys = row.map(headerKey);
      return keys.some((k) => k.includes('narration')) && keys.some((k) => /^value (dat|dt)/.test(k)) && keys.some((k) => k.includes('closing balance'));
    });
  }

  parse(sheet: Sheet): ParsedStatement {
    return readStatement(sheet, { adapter: this.id, bank: 'HDFC Bank', isFooter });
  }
}

function isFooter(row: readonly string[]): boolean {
  return /^(STATEMENT SUMMARY|OPENING BALANCE|GENERATED ON)/.test(firstCell(row));
}
