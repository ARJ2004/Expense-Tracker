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

/** "Added 12 · 3 already in your ledger · 1 skipped" after a sync. */
/**
 * Debug builds only: how many bank messages the templates read. "Not recognised" is a bank
 * format no template knows yet, which the anonymizer turns into a test case to add.
 */
export function coverageLabel(r: Pick<SyncResult, 'read' | 'found' | 'unrecognised'>): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  return `${n(r.read, 'bank message')} · ${n(r.found, 'payment')} · ${r.unrecognised} not recognised`;
}

export function syncSummary(r: Pick<SyncResult, 'created' | 'merged' | 'skipped' | 'found' | 'rejected'>): string {
  if (r.found === 0) return 'No new bank transactions in your SMS.';
  const parts = [`Added ${r.created}`];
  const known = r.merged + r.skipped;
  if (known > 0) parts.push(`${known} already in your ledger`);
  if (r.rejected > 0) parts.push(`${r.rejected} skipped (date looked wrong)`);
  return parts.join(' · ');
}
