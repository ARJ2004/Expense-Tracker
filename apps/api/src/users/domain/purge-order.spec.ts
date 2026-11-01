import type { Prisma } from '@prisma/client';
import { PURGE_ORDER, purgeOwnedData, type PurgeOwners } from './purge-order';

/** Records the order the owners were asked to purge in, and that each got the same tx and user. */
async function runAndRecordOwners(): Promise<string[]> {
  const called: string[] = [];
  const tx = {} as Prisma.TransactionClient;
  const owner = (name: string) => ({
    purgeUser: (userId: string, got: Prisma.TransactionClient) => {
      expect(userId).toBe('user-1');
      expect(got).toBe(tx);
      called.push(name);
      return Promise.resolve();
    },
  });
  const owners: PurgeOwners = { imports: owner('imports'), ledger: owner('ledger'), categories: owner('categories'), accounts: owner('accounts') };
  await purgeOwnedData(owners, tx, 'user-1');
  return called;
}

describe('purge-order', () => {
  it('purges the ledger before accounts (the RESTRICT foreign key)', async () => {
    const owners = await runAndRecordOwners();
    expect(owners.indexOf('ledger')).toBeLessThan(owners.indexOf('accounts'));
  });

  it('purges imports before the ledger and categories they point at', async () => {
    const owners = await runAndRecordOwners();
    expect(owners.indexOf('imports')).toBeLessThan(owners.indexOf('ledger'));
    expect(owners.indexOf('imports')).toBeLessThan(owners.indexOf('categories'));
  });

  it('asks every owning module exactly once, in PURGE_ORDER', async () => {
    expect(await runAndRecordOwners()).toEqual([...PURGE_ORDER]);
  });
});
