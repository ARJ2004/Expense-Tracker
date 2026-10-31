/**
 * Timestamps are stored in UTC and shown in India Standard Time (UTC+05:30, no daylight saving).
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

function shifted(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Calendar day in IST as "YYYY-MM-DD"; used to group the ledger by day. */
export function istDateKey(date: Date): string {
  return shifted(date).toISOString().slice(0, 10);
}

/** Wall-clock time in IST as "h:mm am/pm". */
export function formatISTTime(date: Date): string {
  const d = shifted(date);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** IST calendar date as "31 Oct 2026", or "31 Oct" with { year: false }. */
export function formatISTDate(date: Date, options: { year?: boolean } = {}): string {
  const d = shifted(date);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return options.year === false ? base : `${base} ${d.getUTCFullYear()}`;
}

/** "31 Oct 2026, 1:12 pm" in IST. */
export function formatISTDateTime(date: Date): string {
  return `${formatISTDate(date)}, ${formatISTTime(date)}`;
}

/** "Today, 1:12 pm", "Yesterday, 9:05 am" or "28 Oct, 6:40 pm" relative to `now`, in IST. */
export function formatISTRelative(date: Date, now: Date = new Date()): string {
  const day = istDateKey(date);
  const today = istDateKey(now);
  const yesterday = istDateKey(new Date(now.getTime() - 86_400_000));
  const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : formatISTDate(date, { year: false });
  return `${label}, ${formatISTTime(date)}`;
}
