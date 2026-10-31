import type { NormalizedTxn, TxnType } from '@et/domain';
import type { TypeRule } from '../pipeline';

/** HDFC "ATW-" / "NWD-", "ATM WDL", "CASH WITHDRAWAL" debits are cash taken out, not spending yet. */
export class AtmRule implements TypeRule {
  readonly name = 'atm';

  classify(txn: NormalizedTxn): TxnType | null {
    if (txn.direction !== 'debit' || !txn.narration) return null;
    return /^(ATW|NWD|ATM)\b|ATM (WDL|CASH|WITHDRAWAL)|CASH WITHDRAWAL/i.test(txn.narration.trim()) ? 'atm_withdrawal' : null;
  }
}
