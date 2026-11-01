import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contribute, ContributionResult, CreateGoal, Goal, GoalDetail, GoalStatus, UpdateGoal } from '@et/api-client';
import { api, toApiError } from '../../lib';

/** Goals never touch the ledger: their mutations refresh goal queries only. */
export const goalKeys = {
  all: ['goals'] as const,
  list: (status: GoalStatus) => ['goals', 'list', status] as const,
  detail: (id: string) => ['goals', 'detail', id] as const,
};

export function useGoals(status: GoalStatus = 'active') {
  return useQuery({
    queryKey: goalKeys.list(status),
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await api.GET('/v1/goals', { params: { query: { status } } });
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: async (): Promise<GoalDetail> => {
      const { data, error } = await api.GET('/v1/goals/{id}', { params: { path: { id } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

function useRefreshGoals() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: goalKeys.all });
}

export function useCreateGoal() {
  const refresh = useRefreshGoals();
  return useMutation({
    mutationFn: async (body: CreateGoal): Promise<Goal> => {
      const { data, error } = await api.POST('/v1/goals', { body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useUpdateGoal(id: string) {
  const refresh = useRefreshGoals();
  return useMutation({
    mutationFn: async (body: UpdateGoal): Promise<Goal> => {
      const { data, error } = await api.PATCH('/v1/goals/{id}', { params: { path: { id } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDeleteGoal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/goals/{id}', { params: { path: { id } } });
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: goalKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/** "Saved today": the response says which milestones it reached, for the celebration. */
export function useContribute(id: string) {
  const refresh = useRefreshGoals();
  return useMutation({
    mutationFn: async (body: Contribute): Promise<ContributionResult> => {
      const { data, error } = await api.POST('/v1/goals/{id}/contributions', { params: { path: { id } }, body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useRemoveContribution(id: string) {
  const refresh = useRefreshGoals();
  return useMutation({
    mutationFn: async (contributionId: string): Promise<Goal> => {
      const { data, error } = await api.DELETE('/v1/goals/{id}/contributions/{contributionId}', { params: { path: { id, contributionId } } });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: refresh,
  });
}
