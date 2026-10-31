import type { AccountKind } from '@et/domain';

/** What a statement or SMS tells us about the account: bank name and/or last digits. */
export interface AccountHint {
  bank?: string;
  last4?: string;
  kind?: AccountKind;
}

export interface AccountKey {
  bankName: string;
  last4: string | null;
  kind: AccountKind;
}

/** Trims the bank name, keeps only the last 4 digits; null when there's nothing to match on. */
export function normalizeAccountHint(hint: AccountHint): AccountKey | null {
  const bankName = hint.bank?.trim().replace(/\s+/g, ' ') ?? '';
  const digits = hint.last4?.replace(/\D/g, '') ?? '';
  if (!bankName) return null;
  return { bankName, last4: digits.length >= 4 ? digits.slice(-4) : null, kind: hint.kind ?? 'savings' };
}
