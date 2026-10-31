import { istDateKey } from '@et/domain';
import type { ExportRow } from '../../ingest';

/**
 * Turns ledger rows into a CSV, with no Nest or Prisma so it is unit-testable. Amounts come
 * straight from integer paise (rupees as a plain "1234.56" string, no symbol or grouping) so a
 * spreadsheet reads them as numbers and no float drift is possible. Dates are the IST calendar
 * day. Fields are RFC 4180 quoted.
 */
export const EXPORT_COLUMNS = ['date', 'amount', 'direction', 'type', 'category', 'merchant', 'account', 'note', 'sources'] as const;

export function csvHeader(): string {
  return EXPORT_COLUMNS.join(',') + '\r\n';
}

export function csvLine(row: ExportRow): string {
  const fields = [
    istDateKey(row.occurredAt),
    paiseToRupeeString(row.amountPaise),
    row.direction,
    row.type,
    row.category,
    row.merchantName ?? '',
    row.account ?? '',
    row.note ?? '',
    row.sources.join('|'),
  ];
  return fields.map(csvField).join(',') + '\r\n';
}

/** Integer paise → "1234.56" (always two decimals), sign kept, never through a float divide. */
function paiseToRupeeString(amountPaise: number): string {
  const negative = amountPaise < 0;
  const abs = Math.abs(amountPaise);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Quotes a field when it holds a comma, quote, or newline; doubles embedded quotes. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
