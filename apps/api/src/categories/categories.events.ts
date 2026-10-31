/** Emitted after a custom category is deleted. Ingest listens and moves its transactions to Other. */
export const CATEGORY_DELETED = 'category.deleted';

export interface CategoryDeletedEvent {
  userId: string;
  categoryId: string;
}
