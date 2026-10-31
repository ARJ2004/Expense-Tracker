import type { NormalizedTxn, TxnType } from '@et/domain';
import type { TypeRule } from '../pipeline';

/** A credit that says REFUND or REVERSAL undoes a spend; it is not income. */
export class RefundRule implements TypeRule {
  readonly name = 'refund';

  classify(txn: NormalizedTxn): TxnType | null {
    if (txn.direction !== 'credit' || !txn.narration) return null;
    return /\b(REFUND|RFND|REVERSAL|REVERSED|REV)\b/i.test(txn.narration) ? 'refund' : null;
  }
}
