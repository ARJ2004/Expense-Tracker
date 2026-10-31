import type { Direction } from '@et/domain';

/** Every cell of the uploaded sheet as text, top to bottom, including the bank's preamble lines. */
export type Sheet = string[][];

/** One statement line, before it becomes a NormalizedTxn. Money in paise, date as an IST day. */
export interface StatementRow {
  /** 1-based position among the statement's transaction rows (not the sheet's line number). */
  rowNo: number;
  /** "YYYY-MM-DD". Statements give a day, rarely a time. */
  date: string;
  amountPaise: number;
  direction: Direction;
  narration: string;
  counterparty?: string;
  referenceNo?: string;
  balancePaise?: number;
}

export interface ParsedStatement {
  /** Adapter that read it, e.g. "hdfc" or "generic". */
  adapter: string;
  /** Display name when known, e.g. "HDFC Bank". */
  bank?: string;
  /** Last 4 digits of the account number, if the preamble shows it. */
  accountLast4?: string;
  rows: StatementRow[];
  /** Lines that looked like transactions but could not be read (date or amount missing). */
  skipped: number;
}

/**
 * One implementation per bank, plus a generic fallback that finds columns by name.
 * Adding a bank means adding one adapter and registering it; shared code never branches on bank.
 */
export interface StatementAdapter {
  id: string;
  detect(sheet: Sheet, fileName: string): boolean;
  parse(sheet: Sheet): ParsedStatement;
}
