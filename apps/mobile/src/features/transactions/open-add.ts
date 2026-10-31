import { useQueryClient } from '@tanstack/react-query';
import type { Account, TransactionSummary } from '@et/api-client';
import { accountKeys } from '../accounts';
import { useAddSheet } from './add-sheet';
import { transactionKeys } from './hooks';

/** Opens a fresh Add sheet with the last used account, or else the first one, pre-selected. */
export function useOpenAddSheet() {
  const queryClient = useQueryClient();
  const openNew = useAddSheet((s) => s.openNew);
  return () => {
    const recent = queryClient.getQueryData<TransactionSummary[]>([...transactionKeys.recent, 5]);
    const accounts = queryClient.getQueryData<Account[]>(accountKeys.all);
    openNew({ accountId: recent?.[0]?.account?.id ?? accounts?.[0]?.id ?? null });
  };
}
