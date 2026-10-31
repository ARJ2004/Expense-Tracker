import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CapturedTxn, IngestBatchResult } from '@et/api-client';
import SmsInbox from '../../native/NativeSmsInbox';
import { api, ApiError, toApiError } from '../../lib';
import { transactionKeys } from '../transactions';
import { useSmsCapture } from './store';
import { syncInbox, type SyncResult } from './sync';

async function sendBatch(items: CapturedTxn[]): Promise<IngestBatchResult> {
  const { data, error } = await api.POST('/v1/ingest/batch', { body: { items } });
  if (!data) throw toApiError(error);
  return data;
}

/**
 * Reads new bank SMS, parses them on the phone and sends the transactions. Afterwards the ledger
 * and Home are stale (new rows, or statement rows that gained an SMS source).
 */
export function useSmsSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      if (!SmsInbox) throw new ApiError('SMS_UNAVAILABLE', 'Reading SMS works on Android only.');
      const store = useSmsCapture.getState();
      try {
        const result = await syncInbox({
          readInbox: (sinceMs, limit) => SmsInbox!.readInbox(sinceMs, limit),
          send: sendBatch,
          watermark: () => useSmsCapture.getState().watermarkMs,
          setWatermark: store.setWatermark,
        });
        store.setLastSync(Date.now());
        return result;
      } catch (e) {
        if (e instanceof ApiError) throw e;
        if ((e as { code?: string }).code === 'E_PERMISSION') {
          store.setEnabled(false);
          throw new ApiError('SMS_PERMISSION', 'SMS permission was turned off. Allow it again to keep reading bank SMS.');
        }
        throw new ApiError('SMS_READ', "Couldn't read your SMS inbox. Try again.");
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  });
}
