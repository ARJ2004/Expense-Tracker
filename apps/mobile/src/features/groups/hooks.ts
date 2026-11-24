import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGroup,
  GroupActivity,
  GroupActivityList,
  GroupDetail,
  GroupMember,
  GroupSummary,
  SaveGroupExpense,
  SaveGroupPayment,
  UpdateGroup,
} from '@et/api-client';
import { api, toApiError } from '../../lib';

const PAGE_SIZE = 50;

/**
 * Group expenses never touch the ledger: their mutations refresh group queries only, never
 * ['transactions'] or ['dashboard'].
 */
export const groupKeys = {
  all: ['groups'] as const,
  list: (archived: boolean) => ['groups', 'list', archived] as const,
  detail: (id: string) => ['groups', 'detail', id] as const,
  activity: (id: string) => ['groups', 'activity', id] as const,
};

export function useGroups(archived = false) {
  return useQuery({
    queryKey: groupKeys.list(archived),
    queryFn: async (): Promise<GroupSummary[]> => {
      const { data, error } = await api.GET('/v1/groups', { params: { query: { archived } } });
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async (): Promise<GroupDetail> => {
      const { data, error } = await api.GET('/v1/groups/{id}', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

/** Expenses and payments, newest first, a page at a time. */
export function useGroupActivity(id: string) {
  return useInfiniteQuery({
    queryKey: groupKeys.activity(id),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<GroupActivityList> => {
      const query = { limit: PAGE_SIZE, ...(pageParam && { cursor: pageParam }) };
      const { data, error } = await api.GET('/v1/groups/{id}/activity', { params: { path: { id }, query } });
      if (!data) throw toApiError(error);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** After any change: the list (net balances), and every open group's detail and activity. */
function useRefreshGroups() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: groupKeys.all });
}

export function useCreateGroup() {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (body: CreateGroup): Promise<GroupDetail> => {
      const { data, error } = await api.POST('/v1/groups', { body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useUpdateGroup(id: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (body: UpdateGroup): Promise<GroupDetail> => {
      const { data, error } = await api.PATCH('/v1/groups/{id}', { params: { path: { id } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDeleteGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/groups/{id}', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: groupKeys.detail(id) });
      queryClient.removeQueries({ queryKey: groupKeys.activity(id) });
      return queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useAddMember(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (name: string): Promise<GroupMember> => {
      const { data, error } = await api.POST('/v1/groups/{id}/members', { params: { path: { id: groupId } }, body: { name } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useRenameMember(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async ({ memberId, name }: { memberId: string; name: string }): Promise<GroupMember> => {
      const { data, error } = await api.PATCH('/v1/groups/{id}/members/{memberId}', { params: { path: { id: groupId, memberId } }, body: { name } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useRemoveMember(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/groups/{id}/members/{memberId}', { params: { path: { id: groupId, memberId } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: refresh,
  });
}

/** Adds an expense, or replaces the one with `expenseId`. */
export function useSaveExpense(groupId: string, expenseId?: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (body: SaveGroupExpense): Promise<GroupActivity> => {
      const { data, error } = expenseId
        ? await api.PUT('/v1/groups/{id}/expenses/{expenseId}', { params: { path: { id: groupId, expenseId } }, body })
        : await api.POST('/v1/groups/{id}/expenses', { params: { path: { id: groupId } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDeleteExpense(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (expenseId: string): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/groups/{id}/expenses/{expenseId}', { params: { path: { id: groupId, expenseId } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: refresh,
  });
}

export function useRecordPayment(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (body: SaveGroupPayment): Promise<GroupActivity> => {
      const { data, error } = await api.POST('/v1/groups/{id}/payments', { params: { path: { id: groupId } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDeletePayment(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (paymentId: string): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/groups/{id}/payments/{paymentId}', { params: { path: { id: groupId, paymentId } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: refresh,
  });
}
