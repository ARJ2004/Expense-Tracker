import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Budget, BudgetOverview, SetBudget } from '@et/api-client';
import { api, ledgerRoots, toApiError } from '../../lib';

/** Under the ledger's "budgets" root, so any ledger write refreshes spend and the allowance. */
export const budgetKeys = {
  all: ledgerRoots.budgets,
  month: (month: string | undefined) => [...ledgerRoots.budgets, month ?? 'current'] as const,
};

/** A month's budgets; without a month, the current one with today's allowance. */
export function useBudgets(month?: string) {
  return useQuery({
    queryKey: budgetKeys.month(month),
    queryFn: async (): Promise<BudgetOverview> => {
      const { data, error } = await api.GET('/v1/budgets', { params: { query: month ? { month } : {} } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

/** Budgets change the allowance and can unlock a badge: refresh both. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: budgetKeys.all }), queryClient.invalidateQueries({ queryKey: ['rewards'] }), queryClient.invalidateQueries({ queryKey: ledgerRoots.notifications })]);
}

export function useSetBudget() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ categoryId, body }: { categoryId: string; body: SetBudget }): Promise<Budget> => {
      const { data, error } = await api.PUT('/v1/budgets/{categoryId}', { params: { path: { categoryId } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDeleteBudget() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (categoryId: string): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/budgets/{categoryId}', { params: { path: { categoryId } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: refresh,
  });
}
