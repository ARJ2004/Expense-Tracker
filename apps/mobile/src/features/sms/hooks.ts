import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toApiError } from '../../lib';
import { transactionKeys } from '../transactions';
import { ensureLiveSmsPermission } from './permission';
import { runSmsSync } from './run';
import { mirrorLiveCapture, useSmsCapture } from './store';

/** Data sources: transactions and last activity per source, from the API. */
export const sourceKeys = { all: ['ingest', 'sources'] as const };

/** App open syncs at most this often (the SMS receiver covers the rest). */
const FOREGROUND_EVERY_MS = 60_000;

/** Everything a sync can change: the ledger, Home and the per-source counts. */
function invalidateAfterSync(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: sourceKeys.all }),
  ]);
}

/**
 * Reads new bank SMS, parses them on the phone and sends the transactions. Afterwards the ledger
 * and Home are stale (new rows, or statement rows that gained an SMS source).
 */
export function useSmsSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runSmsSync,
    onSettled: () => invalidateAfterSync(queryClient),
  });
}

/**
 * While capture is on: keeps the native receiver's copy of the setting current, makes sure it may
 * receive SMS, and syncs whenever the app comes to the front. Mount once, in the signed-in app.
 */
export function useSmsForegroundSync() {
  const queryClient = useQueryClient();
  const enabled = useSmsCapture((s) => s.enabled);
  useEffect(() => {
    mirrorLiveCapture(enabled);
    if (!enabled) return;
    ensureLiveSmsPermission();
    const sync = () => {
      const last = useSmsCapture.getState().lastSyncMs ?? 0;
      if (Date.now() - last < FOREGROUND_EVERY_MS) return;
      runSmsSync()
        .then(() => invalidateAfterSync(queryClient))
        .catch(() => undefined);
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [enabled, queryClient]);
}

/** Transactions and last activity for each source (SMS, statements, manual). */
export function useSourceStats() {
  return useQuery({
    queryKey: sourceKeys.all,
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/ingest/sources');
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}
