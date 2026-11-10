import { useQuery } from '@tanstack/react-query';
import type { Rewards } from '@et/api-client';
import { api, toApiError } from '../../lib';

export const rewardKeys = { all: ['rewards'] as const };

/** Streak, the last 14 closed days and every badge. Days close once a morning, so it changes slowly. */
export function useRewards() {
  return useQuery({
    queryKey: rewardKeys.all,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Rewards> => {
      const { data, error } = await api.GET('/v1/rewards');
      if (!data) throw toApiError(error);
      return data;
    },
  });
}
