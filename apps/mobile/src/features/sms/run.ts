import type { CapturedTxn, IngestBatchResult } from '@et/api-client';
import SmsInbox from '../../native/NativeSmsInbox';
import { api, ApiError, toApiError } from '../../lib';
import { parseSender } from '@et/parsers';
import { BANK_SENDERS, catchUpWatermark, markCaughtUp, needsCatchUp, readBefore, senderDecision, syncStillAllowed, useSmsCapture } from './store';
import { BATCH_SIZE } from './sync';
import { syncInbox, type SyncDeps, type SyncResult } from './sync';

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

const NOTHING: SyncResult = { read: 0, found: 0, unrecognised: 0, held: 0, created: 0, merged: 0, skipped: 0, rejected: 0 };

function sum(a: SyncResult, b: SyncResult): SyncResult {
  const keys = Object.keys(NOTHING) as (keyof SyncResult)[];
  return Object.fromEntries(keys.map((k) => [k, a[k] + b[k]])) as unknown as SyncResult;
}

/**
 * The last digits of the person's accounts: a new sender that names one of them is their bank.
 * Empty if they can't be loaded; those senders are then held for the person to confirm.
 */
async function accountDigits(): Promise<Set<string>> {
  const { data } = await api.GET('/v1/accounts').catch(() => ({ data: undefined }));
  const digits = (data?.items ?? []).map((a) => /(\d{3,4})$/.exec(a.maskedNumber ?? '')?.[1]).filter((d): d is string => !!d);
  return new Set(digits.flatMap((d) => [d, d.slice(-3)]));
}

/**
 * "Yes, my bank": sends what this sender's SMS held, then trusts it. If sending fails nothing is
 * lost: the transactions stay held and the person can try again.
 */
export async function approveSender(code: string): Promise<IngestBatchResult> {
  const items = (useSmsCapture.getState().held[code] ?? []).map((h) => h.item);
  const total: IngestBatchResult = { created: 0, merged: 0, skipped: 0, rejected: 0 };
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const result = await sendBatch(items.slice(i, i + BATCH_SIZE));
    total.created += result.created;
    total.merged += result.merged;
    total.skipped += result.skipped;
    total.rejected += result.rejected;
  }
  useSmsCapture.getState().approve(code);
  return total;
}

async function run(): Promise<SyncResult> {
  if (!SmsInbox) throw new ApiError('SMS_UNAVAILABLE', 'Reading SMS works on Android only.');
  const store = useSmsCapture.getState();
  // Only with capture on, and only for as long as nothing resets it (Turn off, another user).
  const generation = store.generation;
  const active = () => syncStillAllowed(generation);
  if (!active()) return NOTHING;
  const onProgress = (read: number, total: number) => store.setProgress(total >= PROGRESS_FROM ? { read, total } : null);
  try {
    const digits = await accountDigits();
    const common: Omit<SyncDeps, 'watermark' | 'setWatermark'> = {
      active,
      readInbox: (sinceMs, limit) => SmsInbox!.readInbox(sinceMs, limit, BANK_SENDERS),
      countInbox: (sinceMs) => SmsInbox!.countInbox(sinceMs, BANK_SENDERS),
      onProgress,
      send: sendBatch,
      decide: (sender, item) => senderDecision(sender, item, digits),
      hold: (sender, item, receivedAt) => {
        const code = parseSender(sender)?.code;
        if (code) store.hold(code, { item, receivedAt });
      },
    };
    // Synced by a version that read fewer senders: read the last 90 days once more for the rest
    // (the API skips what is already in the ledger).
    const catchUp = needsCatchUp()
      ? await syncInbox({
          ...common,
          decide: (sender, item) => (readBefore(sender) ? 'drop' : senderDecision(sender, item, digits)),
          watermark: catchUpWatermark.get,
          setWatermark: catchUpWatermark.set,
        })
      : NOTHING;
    // The catch-up read up to now: the regular read starts where it ended, not over again.
    const caughtUpTo = catchUpWatermark.get();
    if (active() && caughtUpTo !== null && caughtUpTo > (useSmsCapture.getState().watermarkMs ?? 0)) store.setWatermark(caughtUpTo);
    const result = await syncInbox({ ...common, watermark: () => useSmsCapture.getState().watermarkMs, setWatermark: store.setWatermark });
    if (active()) {
      markCaughtUp();
      store.setLastSync(Date.now());
    }
    return sum(catchUp, result);
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
