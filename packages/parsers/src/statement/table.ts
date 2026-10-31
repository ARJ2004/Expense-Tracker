import type { Direction } from '@et/domain';
import { cell, headerKey, parseAmount, parseDate } from './cells';
import { parseNarration } from './narration';
import type { Sheet, StatementRow } from './types';

/** Where each field sits in the header row (column index). */
export interface ColumnMap {
  date: number;
  narration: number;
  reference?: number;
  /** Separate withdrawal / deposit columns… */
  debit?: number;
  credit?: number;
  /** …or one amount column with a Dr/Cr column (or a sign) beside it. */
  amount?: number;
  drCr?: number;
  balance?: number;
}

/** Header synonyms per field, matched against headerKey() text. First match wins. */
export type ColumnSynonyms = Record<keyof ColumnMap, readonly RegExp[]>;

export const COMMON_SYNONYMS: ColumnSynonyms = {
  date: [/^(txn |transaction |tran |posting )?date$/, /^date$/, /^txn dt$/],
  narration: [/narration/, /description/, /particulars/, /^remarks$/, /^details$/, /transaction details/],
  reference: [/ref/, /chq/, /cheque/],
  debit: [/withdrawal/, /^debit/, /^dr amount/, /paid out/],
  credit: [/deposit/, /^credit/, /^cr amount/, /paid in/],
  amount: [/^amount/, /^txn amount/, /^transaction amount/],
  drCr: [/^dr ?\/? ?cr$/, /^cr ?\/? ?dr$/, /^dr cr$/, /^cr dr$/, /^type$/],
  balance: [/balance/],
};

/** Maps a header row to columns. Returns null unless date, narration and some amount column are present. */
export function mapColumns(header: readonly string[], synonyms: ColumnSynonyms = COMMON_SYNONYMS): ColumnMap | null {
  const keys = header.map(headerKey);
  const taken = new Set<number>();
  const find = (field: keyof ColumnMap): number | undefined => {
    for (const pattern of synonyms[field]) {
      const i = keys.findIndex((k, idx) => !taken.has(idx) && k !== '' && pattern.test(k));
      if (i >= 0) {
        taken.add(i);
        return i;
      }
    }
    return undefined;
  };
  // Order matters: "value date" must not be claimed as the date, and "balance" never as an amount.
  const balance = find('balance');
  const narration = find('narration');
  const date = find('date');
  const debit = find('debit');
  const credit = find('credit');
  const drCr = find('drCr');
  const amount = debit === undefined && credit === undefined ? find('amount') : undefined;
  const reference = find('reference');
  if (date === undefined || narration === undefined) return null;
  if (debit === undefined && credit === undefined && amount === undefined) return null;
  return { date, narration, reference, debit, credit, amount, drCr, balance };
}

/** Index of the first row (within the first `scan` rows) that maps to columns. */
export function findHeaderRow(sheet: Sheet, scan = 40, synonyms?: ColumnSynonyms): { index: number; columns: ColumnMap } | null {
  for (let i = 0; i < Math.min(scan, sheet.length); i++) {
    const columns = mapColumns(sheet[i] ?? [], synonyms);
    if (columns) return { index: i, columns };
  }
  return null;
}

export interface ReadResult {
  rows: StatementRow[];
  skipped: number;
}

/**
 * Reads transaction rows below the header until the footer. A row with no date and no amounts
 * but some narration continues the previous row's narration (banks wrap long narrations).
 * Separator rows ("*****") and blank rows are ignored.
 */
export function readRows(sheet: Sheet, headerIndex: number, columns: ColumnMap, isFooter: (row: readonly string[]) => boolean = () => false): ReadResult {
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (let i = headerIndex + 1; i < sheet.length; i++) {
    const raw = sheet[i] ?? [];
    if (isFooter(raw)) break;
    const text = raw.map(cell).filter(Boolean);
    if (text.length === 0 || text.every((t) => /^[*=_-]+$/.test(t))) continue;

    const date = parseDate(raw[columns.date]);
    const narration = cell(raw[columns.narration]);
    const money = readMoney(raw, columns);

    if (!date && !money) {
      const prev = rows[rows.length - 1];
      if (prev && narration && cell(raw[columns.date]) === '') {
        prev.narration = `${prev.narration} ${narration}`.trim();
        Object.assign(prev, narrationFields(prev.narration, prev.referenceNo));
        continue;
      }
      // A row with text but nothing readable: a sub-header or totals line once rows have started.
      if (rows.length > 0) skipped++;
      continue;
    }
    if (!date || !money) {
      skipped++;
      continue;
    }

    const balance = columns.balance === undefined ? null : parseAmount(raw[columns.balance]);
    const reference = columns.reference === undefined ? '' : cell(raw[columns.reference]).replace(/^0+$/, '');
    const row: StatementRow = {
      rowNo: rows.length + 1,
      date,
      amountPaise: money.paise,
      direction: money.direction,
      narration,
      ...narrationFields(narration, reference || undefined),
    };
    if (balance) row.balancePaise = balance.side === 'debit' ? -balance.paise : balance.paise;
    rows.push(row);
  }
  return { rows, skipped };
}

function narrationFields(narration: string, referenceNo: string | undefined): Pick<StatementRow, 'counterparty' | 'referenceNo'> {
  const parts = parseNarration(narration);
  const out: Pick<StatementRow, 'counterparty' | 'referenceNo'> = {};
  if (parts.counterparty) out.counterparty = parts.counterparty;
  const ref = parts.referenceNo ?? referenceNo;
  if (ref) out.referenceNo = ref;
  return out;
}

function readMoney(raw: readonly string[], c: ColumnMap): { paise: number; direction: Direction } | null {
  const debit = c.debit === undefined ? null : parseAmount(raw[c.debit]);
  const credit = c.credit === undefined ? null : parseAmount(raw[c.credit]);
  if (debit && !credit) return { paise: debit.paise, direction: 'debit' };
  if (credit && !debit) return { paise: credit.paise, direction: 'credit' };
  if (debit && credit) return null;
  if (c.amount === undefined) return null;
  const amount = parseAmount(raw[c.amount]);
  if (!amount) return null;
  const marker = c.drCr === undefined ? '' : cell(raw[c.drCr]).toUpperCase();
  if (/^(DR|D|DEBIT|WITHDRAWAL)\.?$/.test(marker)) return { paise: amount.paise, direction: 'debit' };
  if (/^(CR|C|CREDIT|DEPOSIT)\.?$/.test(marker)) return { paise: amount.paise, direction: 'credit' };
  if (amount.side) return { paise: amount.paise, direction: amount.side };
  return null;
}

/** "Account No :50100123456789", "A/C No. XXXXXXXX6789" in the lines above the header → "6789". */
export function findAccountLast4(sheet: Sheet, headerIndex: number): string | undefined {
  for (let i = 0; i < headerIndex; i++) {
    const line = (sheet[i] ?? []).map(cell).join(' ');
    const m = /\b(?:A\/C|ACCOUNT|ACCT)\.?\s*(?:NO|NUMBER|NUM)?\.?\s*[:-]?\s*([X*\d][X*\d -]{3,})/i.exec(line);
    const digits = m?.[1]?.replace(/[^\dX*]/gi, '');
    if (digits && /\d{4}$/.test(digits)) return digits.slice(-4);
  }
  return undefined;
}
