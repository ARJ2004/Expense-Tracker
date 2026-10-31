import { SYSTEM_CATEGORIES, type TxnType } from '@et/domain';
import type { CategoryHit } from '../pipeline';

const TRANSFERS_CATEGORY_ID = SYSTEM_CATEGORIES.find((c) => c.key === 'transfers')!.id;

/** Money that only moves (cash out of an ATM, between own accounts) is not spending to categorize. */
const MOVES_MONEY: ReadonlySet<TxnType> = new Set(['atm_withdrawal', 'transfer']);

/** Puts an otherwise uncategorized ATM withdrawal or own-account transfer in Transfers. */
export function categoryForType(hit: CategoryHit, type: TxnType): CategoryHit {
  return hit.source === 'default' && MOVES_MONEY.has(type) ? { categoryId: TRANSFERS_CATEGORY_ID, source: 'rule' } : hit;
}
