import type { QueryClient } from '@tanstack/react-query';

/**
 * Roots of every query that reads the ledger. Each owning feature builds its keys under its root
 * (transactionKeys, dashboardKeys, sourceKeys); they live here so any feature that writes to the
 * ledger can refresh all of them without importing the others.
 */
export const ledgerRoots = {
  transactions: ['transactions'] as const,
  dashboard: ['dashboard'] as const,
  sources: ['ingest', 'sources'] as const,
};

/** After any ledger write (add, edit, delete, import, SMS sync): lists, details, Home and source counts. */
export function invalidateLedger(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(Object.values(ledgerRoots).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
