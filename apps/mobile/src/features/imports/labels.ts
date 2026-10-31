import type { Import } from '@et/api-client';
import { formatISTDate } from '@et/domain';
import type { TagTone } from '../../ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Why a parse failed, in plain words. */
const FAILURES: Record<string, string> = {
  IMPORT_UNREADABLE: "Couldn't find transactions in this file",
  IMPORT_NO_ROWS: 'No transactions in this file',
  IMPORT_TOO_MANY_ROWS: 'Too many rows (20,000 max)',
  IMPORT_PDF_SCANNED: 'This PDF is a scan. Download the statement from net banking instead',
  IMPORT_PASSWORD_PROTECTED: 'This PDF has a password',
};

export function failureLabel(code: string | null): string {
  return (code && FAILURES[code]) || "Couldn't read this file";
}

/** A PDF waiting for its password: it can still be opened, so it isn't shown as a failure. */
export function needsPassword(imp: Pick<Import, 'status' | 'error'>): boolean {
  return imp.status === 'failed' && imp.error === 'IMPORT_PASSWORD_PROTECTED';
}

/** "3 Nov · 142 added, 18 duplicates" (locked Imports mockup). */
export function importSubtitle(imp: Import): string {
  const day = formatISTDate(new Date(imp.confirmedAt ?? imp.createdAt), { year: false });
  switch (imp.status) {
    case 'parsing':
      return `${day} · Reading the file…`;
    case 'failed':
      return needsPassword(imp) ? `${day} · Enter its password to open it` : `${day} · ${failureLabel(imp.error)}`;
    case 'review':
      return `${day} · ${imp.newCount} new${imp.duplicateCount ? `, ${imp.duplicateCount} duplicates` : ''}`;
    default: // imported
      return `${day} · ${imp.importedCount} added${imp.duplicateCount ? `, ${imp.duplicateCount} duplicates` : ''}`;
  }
}

export function importTag(imp: Import): { label: string; tone: TagTone } {
  switch (imp.status) {
    case 'parsing':
      return { label: 'Reading', tone: 'neutral' };
    case 'failed':
      return needsPassword(imp) ? { label: 'Needs password', tone: 'warning' } : { label: 'Failed', tone: 'error' };
    case 'review':
      return { label: `${imp.selectedCount} to review`, tone: 'warning' };
    default: // imported
      return { label: 'Done', tone: 'success' };
  }
}

/** "1–31 Oct 2026", "28 Sep – 3 Oct 2026", "Dec 2025 – Jan 2026" style period. */
export function periodLabel(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  if (fy === ty && fm === tm) return fd === td ? `${fd} ${MONTHS[fm - 1]} ${fy}` : `${fd}–${td} ${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty) return `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]} ${ty}`;
  return `${fd} ${MONTHS[fm - 1]} ${fy} – ${td} ${MONTHS[tm - 1]} ${ty}`;
}

/** "12 Oct" for a row's "YYYY-MM-DD" day. */
export function rowDay(day: string): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

/** "HDFC ••1234 · 1–31 Oct 2026 · 166 rows" under the file name on Review. */
export function reviewSubtitle(imp: Import): string {
  const account = imp.account
    ? `${imp.account.bankName.replace(/ Bank$/, '')}${imp.account.maskedNumber ? ` ••${imp.account.maskedNumber}` : ''}`
    : null;
  const period = periodLabel(imp.periodFrom, imp.periodTo);
  return [account, period, imp.rowCount ? `${imp.rowCount} rows` : null].filter(Boolean).join(' · ');
}

/** Shown on Review when this exact file was added before. */
export function alreadyImportedNotice(at: string): string {
  return `You imported this file on ${formatISTDate(new Date(at), { year: false })}. Rows already in your ledger are skipped.`;
}
