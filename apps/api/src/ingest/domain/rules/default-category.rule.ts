import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID, type NormalizedTxn } from '@et/domain';
import type { CategoryHit, CategoryRule } from '../pipeline';

/** Last resort: Income for credits, Other for debits. Always matches, so it goes last. */
export class DefaultCategoryRule implements CategoryRule {
  readonly name = 'default';

  apply(txn: NormalizedTxn): CategoryHit {
    return { categoryId: txn.direction === 'credit' ? INCOME_CATEGORY_ID : OTHER_CATEGORY_ID, source: 'default' };
  }
}
