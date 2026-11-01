import type { Prisma } from '@prisma/client';

/**
 * Emitted inside the database transaction that deletes a custom category, just before the delete.
 * Ingest listens and moves the category's transactions to Other with `tx`, so the move and the
 * delete commit together or not at all (no row is ever left without a category).
 */
export const CATEGORY_DELETED = 'category.deleted';

export interface CategoryDeletedEvent {
  userId: string;
  categoryId: string;
  /** The open transaction the delete runs in; listeners write through it. */
  tx: Prisma.TransactionClient;
}
