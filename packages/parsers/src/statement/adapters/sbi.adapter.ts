import { headerKey } from '../cells';
import { firstCell, preambleText, readStatement } from '../table';
import type { ParsedStatement, Sheet, StatementAdapter } from '../types';

/**
 * State Bank of India account statement (YONO / OnlineSBI "Account Statement" as XLS, delimited
 * text or PDF). A key-value preamble ("Account Number : 00000032…", "IFS Code : SBIN0…"), then
 * Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance, with
 * dates like "1 Oct 2026" and a "computer generated statement" line at the end.
 */
export class SbiAdapter implements StatementAdapter {
  readonly id = 'sbi';

  detect(sheet: Sheet): boolean {
    const header = sheet.slice(0, 40).some((row) => {
      const keys = row.map(headerKey);
      return keys.includes('txn date') && keys.includes('value date') && keys.includes('description') && keys.includes('debit') && keys.includes('credit');
    });
    return header && /\bSBIN0[A-Z0-9]{6}\b|STATE BANK OF INDIA/.test(preambleText(sheet));
  }

  parse(sheet: Sheet): ParsedStatement {
    return readStatement(sheet, { adapter: this.id, bank: 'SBI', isFooter });
  }
}

function isFooter(row: readonly string[]): boolean {
  return /^(\*\*|THIS IS A COMPUTER GENERATED|PLEASE DO NOT SHARE)/.test(firstCell(row));
}
