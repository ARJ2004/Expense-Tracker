import { CASH_CATEGORY_ID, TRANSFERS_CATEGORY_ID, type TxnType } from '@et/domain';
import type { CategoryHit } from '../pipeline';

/**
 * Where an otherwise uncategorized row goes by its type: cash taken out at an ATM is spend
 * (Cash); money moved between the user's own accounts is not (Transfers).
 */
const BY_TYPE: Partial<Record<TxnType, string>> = {
  atm_withdrawal: CASH_CATEGORY_ID,
  transfer: TRANSFERS_CATEGORY_ID,
};

export function categoryForType(hit: CategoryHit, type: TxnType): CategoryHit {
  const categoryId = BY_TYPE[type];
  return hit.source === 'default' && categoryId ? { categoryId, source: 'rule' } : hit;
}
