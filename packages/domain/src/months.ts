/**
 * Calendar months in IST ("2026-10"): the dashboard's unit. Timestamps are UTC; a month starts
 * at 00:00 IST on its first day, so 31 Oct 23:30 IST belongs to October.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** True for "YYYY-MM" with a real month. */
export function isMonthKey(value: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** The IST month a moment falls in. */
export function istMonthKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

/** The month n months after (negative: before) the given one. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** The UTC instants an IST month starts and ends at: [start, end). */
export function istMonthRange(month: string): { start: Date; end: Date } {
  const start = new Date(Date.parse(`${month}-01T00:00:00Z`) - IST_OFFSET_MS);
  const end = new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) - IST_OFFSET_MS);
  return { start, end };
}

/** "October" (or "October 2025" when it isn't the year given as `currentYear`). */
export function monthLabel(month: string, currentYear?: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const name = MONTH_NAMES[m - 1]!;
  return currentYear === undefined || currentYear === y ? name : `${name} ${y}`;
}
