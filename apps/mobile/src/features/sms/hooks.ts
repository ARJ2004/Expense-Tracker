import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, invalidateLedger, ledgerRoots, toApiError } from '../../lib';
import { ensureLiveSmsPermission } from './permission';
import { approveSender, runSmsSync } from './run';
import { mirrorLiveCapture, useSmsCapture } from './store';

/** Data sources: transactions and last activity per source, from the API. */
export const sourceKeys = { all: ledgerRoots.sources };

/** App open syncs at most this often (the SMS receiver covers the rest). */
const FOREGROUND_EVERY_MS = 60_000;

/**
 * Reads new bank SMS, parses them on the phone and sends the transactions. Afterwards the ledger
 * and Home are stale (new rows, or statement rows that gained an SMS source).
 */
export function useSmsSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runSmsSync,
    onSettled: () => invalidateLedger(queryClient),
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
    // The store, not this render's value: a claim or Turn off in the same commit has already run.
    const on = useSmsCapture.getState().enabled;
    mirrorLiveCapture(on);
    if (!on) return;
    ensureLiveSmsPermission();
    const sync = () => {
      const last = useSmsCapture.getState().lastSyncMs ?? 0;
      if (Date.now() - last < FOREGROUND_EVERY_MS) return;
      runSmsSync()
        .then(() => invalidateLedger(queryClient))
        .catch(() => undefined);
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [enabled, queryClient]);
}

/** "Yes, my bank" on a new sender: sends what it held and trusts it from now on. */
export function useApproveSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveSender,
    onSettled: () => invalidateLedger(queryClient),
  });
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
