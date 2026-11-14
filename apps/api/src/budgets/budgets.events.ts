/** Budget events, emitted after the write. Listeners live in the reacting module (rewards). */
export const BUDGET_SET = 'budget.set';

export interface BudgetSetEvent {
  userId: string;
  categoryId: string;
}
