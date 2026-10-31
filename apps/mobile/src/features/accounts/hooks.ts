import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, CreateAccount, UpdateAccount } from '@et/api-client';
import { api, toApiError } from '../../lib';

export const accountKeys = { all: ['accounts'] as const };

export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.all,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await api.GET('/v1/accounts');
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateAccount): Promise<Account> => {
      const { data, error } = await api.POST('/v1/accounts', { body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateAccount }): Promise<Account> => {
      const { data, error } = await api.PATCH('/v1/accounts/{id}', { params: { path: { id } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    // Account names show on transactions too.
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: accountKeys.all }), queryClient.invalidateQueries({ queryKey: ['transactions'] })]),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/accounts/{id}', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
