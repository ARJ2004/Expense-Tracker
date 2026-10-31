import { MAX_AMOUNT_PAISE } from '@et/domain';

/**
 * Cell readers shared by every statement adapter. Pure string → value; never floats for money.
 */

/** Whitespace-trimmed, single-spaced cell text ("" for empty). */
export function cell(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Lower-cased header text with punctuation dropped: "Withdrawal Amt." → "withdrawal amt". */
export function headerKey(value: string | undefined): string {
  return cell(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedAmount {
  paise: number;
  /** Set when the cell itself says which side it is ("Dr", "Cr", a minus sign, brackets). */
  side?: 'debit' | 'credit';
}

/**
 * "1,23,456.78", "₹ 486", "486.5 Dr", "(1,200.00)", "-75.25", "1.2E3" from Excel.
 * Returns null for blank or "0" cells, and for text that is not an amount.
 */
export function parseAmount(raw: string | undefined): ParsedAmount | null {
  let text = cell(raw).toUpperCase().replace(/(INR|RS\.?|₹)/g, '').replace(/[,\s]/g, '');
  if (text === '' || text === '-') return null;
  let side: ParsedAmount['side'];
  const suffix = /(DR|CR)\.?$/.exec(text);
  if (suffix) {
    side = suffix[1] === 'DR' ? 'debit' : 'credit';
    text = text.slice(0, suffix.index);
  }
  if (/^\(.*\)$/.test(text)) {
    side = 'debit';
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    side = 'debit';
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  if (/^\d+(\.\d+)?E[+-]?\d+$/.test(text)) text = expandExponent(text);
  const match = /^(\d+)(?:\.(\d{1,2})\d*)?$/.exec(text);
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (paise === 0 || paise > MAX_AMOUNT_PAISE) return null;
  return side ? { paise, side } : { paise };
}

/** "1.2345E3" → "1234.5" without going through a float. */
function expandExponent(text: string): string {
  const [mantissa = '', exp = '0'] = text.split('E');
  const [int = '', frac = ''] = mantissa.split('.');
  const shift = Number(exp);
  const digits = int + frac;
  const point = int.length + shift;
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

/**
 * A statement date as "YYYY-MM-DD". Indian banks write day first: "31/10/26", "31-10-2026",
 * "31-Oct-2026", "31 Oct 26". Also ISO "2026-10-31" and Excel serial days ("46326").
 */
export function parseDate(raw: string | undefined): string | null {
  const text = cell(raw).toUpperCase();
  if (text === '') return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (m) return ymd(year(m[3]!), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[\s/-]?([A-Z]{3})[A-Z]*[\s/,-]+(\d{2}|\d{4})$/.exec(text);
  if (m && MONTHS[m[2]!]) return ymd(year(m[3]!), MONTHS[m[2]!]!, Number(m[1]));
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    // Excel serial: days since 1899-12-30.
    const serial = Math.floor(Number(text));
    return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
  }
  return null;
}

function year(text: string): number {
  return text.length === 2 ? 2000 + Number(text) : Number(text);
}

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
}
