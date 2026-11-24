/** Group events, emitted after the write commits. Nothing listens yet; listeners live in the reacting module. */
export const GROUP_EXPENSE_CREATED = 'group.expense.created';
export const GROUP_SETTLED = 'group.settled';

export interface GroupExpenseCreatedEvent {
  userId: string;
  groupId: string;
  expenseId: string;
}

/** A payment brought every balance in the group to 0. */
export interface GroupSettledEvent {
  userId: string;
  groupId: string;
}
