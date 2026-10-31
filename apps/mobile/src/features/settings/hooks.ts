import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HealthResponse, Me, UpdateMe } from '@et/api-client';
import { api, toApiError } from '../../lib';
import { useSession } from '../auth';
import { exportLedger } from './export';

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

/** Name, monthly income or pay frequency. The session's user updates and Home's budget figures refetch. */
export function useUpdateMe() {
  const setUser = useSession((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMe): Promise<Me> => {
      const { data, error } = await api.PATCH('/v1/me', { body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: async (me) => {
      setUser(me);
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Downloads the ledger as CSV and opens the system "Save as" dialog. Resolves false if the user cancelled. */
export function useExportLedger() {
  return useMutation({ mutationFn: exportLedger });
}

/** Permanently deletes the account on the server, then forgets everything on this phone. */
export function useDeleteMe() {
  const deleted = useSession((s) => s.deleted);
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.DELETE('/v1/me');
      if (!response.ok) throw toApiError(error);
    },
    onSuccess: deleted,
  });
}
