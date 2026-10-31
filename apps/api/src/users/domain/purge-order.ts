import type { Prisma } from '@prisma/client';

/**
 * The order a user's data must be deleted in so no foreign key blocks the purge. The one that
 * matters: `transactions` carries an onDelete: Restrict FK to `accounts`
 * (transactions_account_id_fkey), so transactions MUST be deleted before accounts — a plain
 * `user.delete()` (which cascades users → accounts) would otherwise throw. category_corrections
 * and transaction_sources are cascade children, listed explicitly so the purge is self-evident
 * and testable rather than relying on cascade behaviour.
 *
 * Custom categories only (system categories have user_id null and are shared, never deleted).
 */
export const PURGE_STEPS = [
  (tx: Prisma.TransactionClient, userId: string) => tx.transactionSource.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.importRow.deleteMany({ where: { import: { userId } } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.statementImport.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.transaction.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.merchantRule.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.categoryCorrection.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.category.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.account.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.refreshToken.deleteMany({ where: { userId } }),
  (tx: Prisma.TransactionClient, userId: string) => tx.user.deleteMany({ where: { id: userId } }),
] as const satisfies ReadonlyArray<(tx: Prisma.TransactionClient, userId: string) => Promise<unknown>>;
