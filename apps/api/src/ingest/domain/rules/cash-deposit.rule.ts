import type { NormalizedTxn, TxnType } from '@et/domain';
import type { TypeRule } from '../pipeline';

/** Cash paid in at a branch or deposit machine. */
export class CashDepositRule implements TypeRule {
  readonly name = 'cash-deposit';

  classify(txn: NormalizedTxn): TxnType | null {
    if (txn.direction !== 'credit' || !txn.narration) return null;
    return /\b(CASH DEP(OSIT)?|BY CASH|CDM)\b/i.test(txn.narration) ? 'cash_deposit' : null;
  }
}
