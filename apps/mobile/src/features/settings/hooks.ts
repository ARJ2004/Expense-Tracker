import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@et/api-client';
import { api } from '../../lib';

export const settingsKeys = { health: ['health'] as const };

/** API liveness for the Settings screen. */
export function useHealth() {
  return useQuery({
    queryKey: settingsKeys.health,
    queryFn: async (): Promise<HealthResponse> => {
      const { data, error } = await api.GET('/v1/health');
      if (error || !data) throw new Error(error?.error.message ?? 'API unreachable');
      return data;
    },
  });
}
