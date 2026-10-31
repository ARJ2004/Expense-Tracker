import { headerKey } from '../cells';
import { firstCell, readStatement } from '../table';
import type { ParsedStatement, Sheet, StatementAdapter } from '../types';

/**
 * Axis Bank account statement (internet banking XLS / CSV / PDF). "Statement of Account No -
 * 912010012345678 for the period (From : … To : …)", then Tran Date | CHQNO | PARTICULARS | DR |
 * CR | BAL | SOL, an "OPENING BALANCE" line, and "TRANSACTION TOTAL" / "CLOSING BALANCE" at the end.
 */
export class AxisAdapter implements StatementAdapter {
  readonly id = 'axis';

  detect(sheet: Sheet): boolean {
    return sheet.slice(0, 40).some((row) => {
      const keys = row.map(headerKey);
      return keys.includes('tran date') && keys.includes('particulars') && keys.includes('dr') && keys.includes('cr') && keys.includes('bal');
    });
  }

  parse(sheet: Sheet): ParsedStatement {
    return readStatement(sheet, { adapter: this.id, bank: 'Axis Bank', isFooter, ignore: isOpening });
  }
}

function isFooter(row: readonly string[]): boolean {
  return /^(TRANSACTION TOTAL|CLOSING BALANCE|UNLESS THE CONSTITUENT)/.test(firstCell(row));
}

function isOpening(row: readonly string[]): boolean {
  return firstCell(row) === 'OPENING BALANCE';
}
