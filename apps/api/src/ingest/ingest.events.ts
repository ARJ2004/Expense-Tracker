/** Ledger events, emitted after the database transaction commits. Listeners live in the reacting module. */
export const TRANSACTION_CREATED = 'transaction.created';
export const TRANSACTION_UPDATED = 'transaction.updated';
export const TRANSACTION_DELETED = 'transaction.deleted';

export interface TransactionEvent {
  userId: string;
  transactionId: string;
}

/** Several rows changed category at once ("apply to all from this merchant"). */
export const TRANSACTIONS_RECATEGORIZED = 'transactions.recategorized';

export interface TransactionsRecategorizedEvent {
  userId: string;
  transactionIds: string[];
}
