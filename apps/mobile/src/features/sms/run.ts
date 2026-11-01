import type { CapturedTxn, IngestBatchResult } from '@et/api-client';
import SmsInbox from '../../native/NativeSmsInbox';
import { api, ApiError, toApiError } from '../../lib';
import { BANK_SENDERS, useSmsCapture } from './store';
import { syncInbox, type SyncResult } from './sync';

/** A sync expecting more bank messages than this shows progress (the first 90 days, a long gap). */
const PROGRESS_FROM = 50;

async function sendBatch(items: CapturedTxn[]): Promise<IngestBatchResult> {
  const { data, error } = await api.POST('/v1/ingest/batch', { body: { items } });
  if (!data) throw toApiError(error);
  return data;
}

let running: Promise<SyncResult> | null = null;

/**
 * Reads new bank SMS, parses them on the phone and sends the transactions. One sync at a time:
 * the SMS receiver, app open and Check now all share the run already in progress.
 */
export function runSmsSync(): Promise<SyncResult> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<SyncResult> {
  if (!SmsInbox) throw new ApiError('SMS_UNAVAILABLE', 'Reading SMS works on Android only.');
  const store = useSmsCapture.getState();
  try {
    const result = await syncInbox({
      readInbox: (sinceMs, limit) => SmsInbox!.readInbox(sinceMs, limit, BANK_SENDERS),
      countInbox: (sinceMs) => SmsInbox!.countInbox(sinceMs, BANK_SENDERS),
      onProgress: (read, total) => store.setProgress(total >= PROGRESS_FROM ? { read, total } : null),
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
  } finally {
    store.setProgress(null);
  }
}
