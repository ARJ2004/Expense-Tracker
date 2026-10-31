import type { NormalizedTxn, TxnType } from '@et/domain';
import type { TypeRule } from '../pipeline';

/** Last resort: expense for debits, income for credits. Transfer, ATM and refund rules go before it. */
export class DirectionTypeRule implements TypeRule {
  readonly name = 'direction';

  classify(txn: NormalizedTxn): TxnType {
    return txn.direction === 'credit' ? 'income' : 'expense';
  }
}
