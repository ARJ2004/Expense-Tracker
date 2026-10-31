import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTransaction, TransactionDetail, TransactionSummary, UpdateTransaction } from '@et/api-client';
import { api, toApiError } from '../../lib';

export const transactionKeys = {
  all: ['transactions'] as const,
  recent: ['transactions', 'recent'] as const,
  recentCategories: ['transactions', 'recent-categories'] as const,
  detail: (id: string) => ['transaction', id] as const,
};

export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: async (): Promise<TransactionDetail> => {
      const { data, error } = await api.GET('/v1/transactions/{id}', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: [...transactionKeys.recent, limit],
    queryFn: async (): Promise<TransactionSummary[]> => {
      const { data, error } = await api.GET('/v1/transactions/recent', { params: { query: { limit } } });
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}

export function useRecentCategoryIds() {
  return useQuery({
    queryKey: transactionKeys.recentCategories,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await api.GET('/v1/transactions/recent-categories');
      if (!data) throw toApiError(error);
      return data.ids;
    },
  });
}

/** After any ledger write: lists and the dashboard are stale; the detail is whatever the API returned. */
function useLedgerWritten() {
  const queryClient = useQueryClient();
  return async (detail?: TransactionDetail) => {
    if (detail) queryClient.setQueryData(transactionKeys.detail(detail.id), detail);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };
}

export function useCreateTransaction() {
  const written = useLedgerWritten();
  return useMutation({
    mutationFn: async (body: CreateTransaction): Promise<TransactionDetail> => {
      const { data, error } = await api.POST('/v1/transactions', { body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: written,
  });
}

export function useUpdateTransaction() {
  const written = useLedgerWritten();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateTransaction }): Promise<TransactionDetail> => {
      const { data, error } = await api.PATCH('/v1/transactions/{id}', { params: { path: { id } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: written,
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const written = useLedgerWritten();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/transactions/{id}', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: transactionKeys.detail(id) });
      await written();
    },
  });
}
