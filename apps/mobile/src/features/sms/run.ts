import type { CapturedTxn, IngestBatchResult } from '@et/api-client';
import SmsInbox from '../../native/NativeSmsInbox';
import { api, ApiError, toApiError } from '../../lib';
import { BANK_SENDERS, syncStillAllowed, useSmsCapture } from './store';
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

const NOTHING: SyncResult = { read: 0, found: 0, unrecognised: 0, created: 0, merged: 0, skipped: 0, rejected: 0 };

async function run(): Promise<SyncResult> {
  if (!SmsInbox) throw new ApiError('SMS_UNAVAILABLE', 'Reading SMS works on Android only.');
  const store = useSmsCapture.getState();
  // Only with capture on, and only for as long as nothing resets it (Turn off, another user).
  const generation = store.generation;
  const active = () => syncStillAllowed(generation);
  if (!active()) return NOTHING;
  try {
    const result = await syncInbox({
      active,
      readInbox: (sinceMs, limit) => SmsInbox!.readInbox(sinceMs, limit, BANK_SENDERS),
      countInbox: (sinceMs) => SmsInbox!.countInbox(sinceMs, BANK_SENDERS),
      onProgress: (read, total) => store.setProgress(total >= PROGRESS_FROM ? { read, total } : null),
      send: sendBatch,
      watermark: () => useSmsCapture.getState().watermarkMs,
      setWatermark: store.setWatermark,
    });
    if (active()) store.setLastSync(Date.now());
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as { code?: string } | null)?.code === 'E_PERMISSION') {
      store.setEnabled(false);
      throw new ApiError('SMS_PERMISSION', 'SMS permission was turned off. Allow it again to keep reading bank SMS.');
    }
    throw new ApiError('SMS_READ', "Couldn't read your SMS inbox. Try again.");
  } finally {
    store.setProgress(null);
  }
}
