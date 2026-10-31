import { cell, headerKey } from '../cells';
import { firstCell, preambleText, readStatement } from '../table';
import type { ParsedStatement, Sheet, StatementAdapter } from '../types';

/**
 * ICICI Bank savings account statement, either layout:
 *   Net banking "Detailed Statement" (XLS): S No. | Value Date | Transaction Date | Cheque Number |
 *     Transaction Remarks | Withdrawal Amount (INR ) | Deposit Amount (INR ) | Balance (INR ), under
 *     "Transactions List - NAME (INR) - 000401234567".
 *   Emailed PDF: DATE | MODE | PARTICULARS | DEPOSITS | WITHDRAWALS | BALANCE, starting with a
 *     "B/F" (brought forward) line.
 */
export class IciciAdapter implements StatementAdapter {
  readonly id = 'icici';

  detect(sheet: Sheet): boolean {
    const netBanking = sheet.slice(0, 40).some((row) => {
      const keys = row.map(headerKey);
      return keys.includes('transaction remarks') && keys.some((k) => k.startsWith('withdrawal amount'));
    });
    return netBanking || /\bICICI BANK\b|\bICIC0[A-Z0-9]{6}\b/.test(preambleText(sheet));
  }

  parse(sheet: Sheet): ParsedStatement {
    return readStatement(sheet, { adapter: this.id, bank: 'ICICI Bank', isFooter, ignore: isBroughtForward, accountLast4 });
  }
}

function isFooter(row: readonly string[]): boolean {
  return /^(LEGENDS|TOTAL|STATEMENT SUMMARY|\*\*)/.test(firstCell(row));
}

/** "B/F" carries the opening balance; it has a date but no amount. */
function isBroughtForward(row: readonly string[]): boolean {
  return row.some((c) => /^B\/F$/i.test(cell(c)));
}

/** "Transactions List - NAME (INR) - 000401234567" or the usual "Account Number …" line. */
function accountLast4(sheet: Sheet, headerIndex: number): string | undefined {
  for (let i = 0; i < headerIndex; i++) {
    const line = (sheet[i] ?? []).map(cell).join(' ');
    const m = /TRANSACTIONS LIST\b.*-\s*[X*]*(\d{4,})\s*$/i.exec(line) ?? /\bACCOUNT (?:NO|NUMBER)\.?\s*[:-]?\s*[X*\d]*?(\d{4})\b/i.exec(line);
    if (m) return m[1]!.slice(-4);
  }
  return undefined;
}
