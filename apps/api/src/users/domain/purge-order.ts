import type { Prisma } from '@prisma/client';

/** A module that owns some of a user's rows and deletes them, inside the purge's transaction. */
export interface PurgeOwner {
  purgeUser(userId: string, tx: Prisma.TransactionClient): Promise<void>;
}

/** The modules that own a user's data; each deletes only its own tables. */
export interface PurgeOwners {
  imports: PurgeOwner;
  ledger: PurgeOwner;
  categories: PurgeOwner;
  accounts: PurgeOwner;
}

/**
 * The order a user's data must be deleted in so no foreign key blocks the purge. The one that
 * matters: `transactions` carries an onDelete: Restrict FK to `accounts`
 * (transactions_account_id_fkey), so the ledger MUST be purged before accounts — a plain
 * `user.delete()` (which cascades users → accounts) would otherwise throw. Imports go first so
 * nothing still points at them. The users row itself (and refresh_tokens, which cascade from it)
 * is deleted by UsersService last.
 */
export const PURGE_ORDER = ['imports', 'ledger', 'categories', 'accounts'] as const satisfies ReadonlyArray<keyof PurgeOwners>;

/** Runs every owner's purge in PURGE_ORDER, one after another, in `tx`. */
export async function purgeOwnedData(owners: PurgeOwners, tx: Prisma.TransactionClient, userId: string): Promise<void> {
  for (const key of PURGE_ORDER) {
    await owners[key].purgeUser(userId, tx);
  }
}
