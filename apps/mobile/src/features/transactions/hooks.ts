import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTransaction,
  RecategorizeResult,
  TransactionDetail,
  TransactionPage,
  TransactionSummary,
  UpdateTransaction,
} from '@et/api-client';
import type { LedgerFilters } from '@et/domain';
import { api, invalidateLedger, ledgerRoots, toApiError } from '../../lib';
import { filtersToQuery } from './ledger';

const PAGE_SIZE = 50;

export const transactionKeys = {
  all: ledgerRoots.transactions,
  recent: [...ledgerRoots.transactions, 'recent'] as const,
  recentCategories: [...ledgerRoots.transactions, 'recent-categories'] as const,
  /** The filter object is part of the key, so changing a filter fetches again. */
  list: (filters: LedgerFilters) => [...ledgerRoots.transactions, 'list', filters] as const,
  /** Under `all`, so a ledger-wide refresh (a merge, apply to merchant) reaches open details too. */
  detail: (id: string) => [...ledgerRoots.transactions, 'detail', id] as const,
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

/** The ledger, 50 rows a page, newest first; follow-up pages load as the list nears its end. */
export function useLedger(filters: LedgerFilters) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<TransactionPage> => {
      const query = { ...filtersToQuery(filters), limit: PAGE_SIZE, ...(pageParam && { cursor: pageParam }) };
      const { data, error } = await api.GET('/v1/transactions', { params: { query } });
      if (!data) throw toApiError(error);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
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

/** After any ledger write: lists, Home and source counts are stale; the detail is whatever the API returned. */
function useLedgerWritten() {
  const queryClient = useQueryClient();
  return async (detail?: TransactionDetail) => {
    if (detail) queryClient.setQueryData(transactionKeys.detail(detail.id), detail);
    await invalidateLedger(queryClient);
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

/** Change category from Detail; applyToMerchant also moves the merchant's other rows and remembers it. */
export function useRecategorize() {
  const written = useLedgerWritten();
  return useMutation({
    mutationFn: async ({ id, categoryId, applyToMerchant }: { id: string; categoryId: string; applyToMerchant: boolean }): Promise<RecategorizeResult> => {
      const { data, error } = await api.PATCH('/v1/transactions/{id}/category', { params: { path: { id } }, body: { categoryId, applyToMerchant } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: (result) => written(result.transaction),
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
