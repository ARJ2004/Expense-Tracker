import type { NormalizedTxn, TxnType } from '@et/domain';
import type { TypeContext, TypeRule } from '../pipeline';

/**
 * Money moved between the user's own accounts: the narration says SELF / OWN A/C, or names a
 * masked account number ending in the last 4 digits of another of their accounts.
 */
export class OwnAccountTransferRule implements TypeRule {
  readonly name = 'own-account-transfer';

  classify(txn: NormalizedTxn, ctx?: TypeContext): TxnType | null {
    const text = txn.narration?.toUpperCase();
    if (!text) return null;
    if (/\b(SELF|OWN A\/?C|OWN ACCOUNT)\b/.test(text)) return 'transfer';
    const accounts = text.match(/[X*\d]{8,}/g) ?? [];
    const own = ctx?.ownAccountLast4 ?? [];
    return accounts.some((a) => /\d{4}$/.test(a) && own.includes(a.slice(-4))) ? 'transfer' : null;
  }
}
