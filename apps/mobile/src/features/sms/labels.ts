import { formatISTRelative } from '@et/domain';
import type { SyncResult } from './sync';

/** Copy for the disclosure, kept in one place so it matches the Play Console declaration. */
export const DISCLOSURE = {
  title: 'Read bank SMS to add spends for you',
  points: [
    'Altus reads SMS from banks (like HDFC Bank, SBI and ICICI Bank) to find debits and credits.',
    'Each message is read on this phone. Only the amount, date, merchant, bank and last 4 digits are sent to your ledger.',
    'A payment that is also in your bank statement shows once, not twice.',
    'You can turn this off any time in Settings.',
  ],
  never: 'Altus never sends the text of any message, never reads personal SMS, OTPs or messages from people, and never sends or deletes SMS.',
} as const;

/** "Last checked Today, 9:05 pm" or "Not checked yet". */
export function lastSyncLabel(lastSyncMs: number | null, now = new Date()): string {
  return lastSyncMs ? `Last checked ${formatISTRelative(new Date(lastSyncMs), now)}` : 'Not checked yet';
}

/** "Today, 9:05 pm", or "Never" for a source that hasn't added anything yet. */
export function lastActivityLabel(iso: string | null, now = new Date()): string {
  return iso ? formatISTRelative(new Date(iso), now) : 'Never';
}

/** "1 transaction", "1,240 transactions". */
export function transactionsLabel(count: number): string {
  return `${count.toLocaleString('en-IN')} transaction${count === 1 ? '' : 's'}`;
}

/** "Reading 120 of 340 bank messages" while a long sync runs. */
export function progressLabel(p: { read: number; total: number }): string {
  return `Reading ${p.read.toLocaleString('en-IN')} of ${p.total.toLocaleString('en-IN')} bank messages`;
}

/**
 * Debug builds only: how many bank messages the templates read. "Not recognised" is a bank
 * format no template knows yet, which the anonymizer turns into a test case to add.
 */
export function coverageLabel(r: Pick<SyncResult, 'read' | 'found' | 'unrecognised'>): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  return `${n(r.read, 'bank message')} · ${n(r.found, 'payment')} · ${r.unrecognised} not recognised`;
}

/** "Added 12 · 3 already in your ledger · 1 skipped" after a sync. */
export function syncSummary(r: Pick<SyncResult, 'created' | 'merged' | 'skipped' | 'found' | 'rejected'>): string {
  if (r.found === 0) return 'No new bank transactions in your SMS.';
  const parts = [`Added ${r.created}`];
  const known = r.merged + r.skipped;
  if (known > 0) parts.push(`${known} already in your ledger`);
  if (r.rejected > 0) parts.push(`${r.rejected} skipped (date looked wrong)`);
  return parts.join(' · ');
}
