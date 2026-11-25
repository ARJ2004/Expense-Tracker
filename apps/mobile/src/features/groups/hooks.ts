import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcceptInvite,
  CreateGroup,
  GroupActivity,
  GroupActivityList,
  GroupDetail,
  GroupHistoryList,
  GroupInvite,
  GroupInviteState,
  GroupMember,
  InvitePreview,
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
  history: (id: string) => ['groups', 'history', id] as const,
  invite: (id: string) => ['groups', 'invite', id] as const,
  preview: (code: string) => ['groups', 'preview', code] as const,
};

/** How often an open group asks for other people's changes. */
const LIVE_REFRESH_MS = 30_000;

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

/** A group, refreshed every 30 s while its screen is open so other people's changes show up. */
export function useGroup(id: string, options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    refetchInterval: options.live ? LIVE_REFRESH_MS : false,
    queryFn: async (): Promise<GroupDetail> => {
      const { data, error } = await api.GET('/v1/groups/{id}', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

/** Expenses and payments, newest first, a page at a time. */
export function useGroupActivity(id: string, options: { live?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: groupKeys.activity(id),
    refetchInterval: options.live ? LIVE_REFRESH_MS : false,
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

/** Deletes an expense; with `version`, refuses if someone changed it since (GROUP_EXPENSE_CHANGED). */
export function useDeleteExpense(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async ({ expenseId, version }: { expenseId: string; version?: number }): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/groups/{id}/expenses/{expenseId}', {
        params: { path: { id: groupId, expenseId }, query: version ? { version } : {} },
      });
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

// ---- Sharing ----

export function useGroupHistory(id: string) {
  return useInfiniteQuery({
    queryKey: groupKeys.history(id),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<GroupHistoryList> => {
      const query = { limit: PAGE_SIZE, ...(pageParam && { cursor: pageParam }) };
      const { data, error } = await api.GET('/v1/groups/{id}/history', { params: { path: { id }, query } });
      if (!data) throw toApiError(error);
      return data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** The group's join link, if one is on. */
export function useInvite(groupId: string) {
  return useQuery({
    queryKey: groupKeys.invite(groupId),
    queryFn: async (): Promise<GroupInviteState> => {
      const { data, error } = await api.GET('/v1/groups/{id}/invite', { params: { path: { id: groupId } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

/** The join link, made if there is none; `reset` (owner only) makes a new one. */
export function useShareInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reset: boolean = false): Promise<GroupInvite> => {
      const { data, error } = await api.POST('/v1/groups/{id}/invite', { params: { path: { id: groupId } }, body: { reset } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: (invite) => queryClient.setQueryData<GroupInviteState>(groupKeys.invite(groupId), { active: true, invite }),
  });
}

export function useTurnOffInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/groups/{id}/invite', { params: { path: { id: groupId } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: () => queryClient.setQueryData<GroupInviteState>(groupKeys.invite(groupId), { active: false }),
  });
}

/** What a join link is for: the group, who invited, and the names to pick from. */
export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: groupKeys.preview(code),
    queryFn: async (): Promise<InvitePreview> => {
      const { data, error } = await api.GET('/v1/invites/{code}', { params: { path: { code } } });
      if (!data) throw toApiError(error);
      return data;
    },
    retry: false,
  });
}

export function useAcceptInvite(code: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (body: AcceptInvite): Promise<GroupDetail> => {
      const { data, error } = await api.POST('/v1/invites/{code}/accept', { params: { path: { code } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.POST('/v1/groups/{id}/leave', { params: { path: { id: groupId } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) });
      return queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

/** Owner: remove someone who joined. Their name and history stay. */
export function useRemoveJoined(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (memberId: string): Promise<GroupDetail> => {
      const { data, error } = await api.DELETE('/v1/groups/{id}/members/{memberId}/link', { params: { path: { id: groupId, memberId } } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useTransferOwner(groupId: string) {
  const refresh = useRefreshGroups();
  return useMutation({
    mutationFn: async (memberId: string): Promise<GroupDetail> => {
      const { data, error } = await api.POST('/v1/groups/{id}/owner', { params: { path: { id: groupId } }, body: { memberId } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}
