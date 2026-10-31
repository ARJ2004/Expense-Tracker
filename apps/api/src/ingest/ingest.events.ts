/** Ledger events, emitted after the database transaction commits. Listeners live in the reacting module. */
export const TRANSACTION_CREATED = 'transaction.created';
export const TRANSACTION_UPDATED = 'transaction.updated';
export const TRANSACTION_DELETED = 'transaction.deleted';

export interface TransactionEvent {
  userId: string;
  transactionId: string;
}
