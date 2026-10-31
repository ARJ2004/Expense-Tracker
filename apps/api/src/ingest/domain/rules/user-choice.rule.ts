import type { NormalizedTxn } from '@et/domain';
import type { CategoryHit, CategoryRule } from '../pipeline';

/** The user picked a category (manual entry): it beats every automatic rule. */
export class UserChoiceRule implements CategoryRule {
  readonly name = 'user-choice';

  apply(txn: NormalizedTxn): CategoryHit | null {
    return txn.categoryId ? { categoryId: txn.categoryId, source: 'user' } : null;
  }
}
