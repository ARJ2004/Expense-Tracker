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
