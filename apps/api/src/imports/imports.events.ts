/** Emitted after a statement import's rows are in the ledger. */
export const IMPORT_CONFIRMED = 'import.confirmed';

export interface ImportConfirmedEvent {
  userId: string;
  importId: string;
  created: number;
  merged: number;
}
