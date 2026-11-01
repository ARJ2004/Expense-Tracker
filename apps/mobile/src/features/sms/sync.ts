import { CAPTURE_LIMITS, MAX_AMOUNT_PAISE, withinFutureLimit } from '@et/domain';
import { isNotAPayment, parseSms, smsMessageKey } from '@et/parsers';
import type { CapturedTxn, IngestBatchResult } from '@et/api-client';
import type { InboxMessage } from '../../native/NativeSmsInbox';

/** The API takes at most this many rows per call. */
export const BATCH_SIZE = CAPTURE_LIMITS.maxBatchItems;
/** Inbox messages read per native call; the loop pages until the inbox is caught up. */
export const READ_PAGE = 500;
/** First sync looks back this far (statement imports cover anything older). */
export const FIRST_SYNC_DAYS = 90;

export interface SyncDeps {
  readInbox(sinceMs: number, limit: number): Promise<InboxMessage[]>;
  /** Bank messages after `sinceMs`, for progress; leave out to skip progress. */
  countInbox?(sinceMs: number): Promise<number>;
  /** Called after each page: bank messages handled so far, of `total`. */
  onProgress?(read: number, total: number): void;
  /** False once the sync must stop (capture turned off, another user signed in); checked before each read and send. */
  active?(): boolean;
  send(items: CapturedTxn[]): Promise<IngestBatchResult>;
  /** Receive time of the newest message already handled; null before the first sync. */
  watermark(): number | null;
  setWatermark(ms: number): void;
  now?: () => number;
}

export interface SyncResult extends IngestBatchResult {
  /** Bank messages read from the inbox. */
  read: number;
  /** Of those, transactions found (the rest were OTPs, offers, balance alerts). */
  found: number;
  /** Bank messages neither parsed nor known non-payments: a format no template reads yet. */
  unrecognised: number;
}

/**
 * The row as the API will accept it (CAPTURE_LIMITS, which CapturedTxnDto validates with): an
 * optional field that doesn't fit is left out, so the payment still counts; a row with no usable
 * amount, bank or time is null and is counted as rejected here instead of being sent.
 */
export function sendable(item: CapturedTxn, now: number): CapturedTxn | null {
  const { bankLength, counterpartyLength } = CAPTURE_LIMITS;
  if (!Number.isInteger(item.amountPaise) || item.amountPaise < 1 || item.amountPaise > MAX_AMOUNT_PAISE) return null;
  if (item.bank.length < bankLength.min || item.bank.length > bankLength.max) return null;
  const at = Date.parse(item.occurredAt);
  if (!Number.isFinite(at) || !withinFutureLimit(new Date(at), new Date(now))) return null;
  const out: CapturedTxn = { ...item };
  if (out.last4 !== undefined && !CAPTURE_LIMITS.last4.test(out.last4)) delete out.last4;
  if (out.counterparty !== undefined && (out.counterparty.length < counterpartyLength.min || out.counterparty.length > counterpartyLength.max)) delete out.counterparty;
  if (out.referenceNo !== undefined && !CAPTURE_LIMITS.referenceNo.test(out.referenceNo)) delete out.referenceNo;
  if (out.narration !== undefined && !CAPTURE_LIMITS.narration.test(out.narration)) delete out.narration;
  return out;
}

/**
 * Sends one batch. The API rejects bad rows one by one, so a whole batch is refused only by an
 * older API: then it is split in halves until the refused row is alone and counted as rejected
 * (about 14 calls for one bad row in 100, well inside the rate limit), so the watermark always
 * moves past a bad message. Anything else, a rate limit or no network, is thrown: the sync stops
 * where it is and the next one carries on from there.
 */
async function sendChunk(deps: SyncDeps, items: CapturedTxn[]): Promise<IngestBatchResult> {
  try {
    return await deps.send(items);
  } catch (e) {
    if (!isValidationError(e)) throw e;
    if (items.length === 1) return { created: 0, merged: 0, skipped: 0, rejected: 1 };
  }
  const half = Math.ceil(items.length / 2);
  const [a, b] = [await sendChunk(deps, items.slice(0, half)), await sendChunk(deps, items.slice(half))];
  return { created: a.created + b.created, merged: a.merged + b.merged, skipped: a.skipped + b.skipped, rejected: a.rejected + b.rejected };
}

function isValidationError(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'VALIDATION_FAILED';
}

/**
 * One SMS as the API receives it: parsed fields and a fingerprint. The body is used here, on the
 * phone, and is never part of what is sent.
 */
export function toCaptured(message: InboxMessage): CapturedTxn | null {
  const receivedAt = new Date(message.receivedAt);
  const txn = parseSms(message.sender, message.body, receivedAt);
  if (!txn) return null;
  const item: CapturedTxn = {
    source: 'sms',
    messageKey: smsMessageKey(message.sender, receivedAt, txn),
    amountPaise: txn.amountPaise,
    direction: txn.direction,
    occurredAt: txn.occurredAt.toISOString(),
    timePrecision: txn.timePrecision,
    bank: txn.accountHint?.bank ?? '',
  };
  if (txn.accountHint?.last4) item.last4 = txn.accountHint.last4;
  if (txn.accountHint?.kind) item.accountKind = txn.accountHint.kind;
  if (txn.counterparty) item.counterparty = txn.counterparty.slice(0, 80);
  if (txn.referenceNo) item.referenceNo = txn.referenceNo;
  if (txn.narration) item.narration = txn.narration;
  return item;
}

/**
 * Reads new bank SMS, parses them on the phone and sends the transactions in batches. The
 * watermark moves only after a batch is accepted, so a failure part-way resumes from the last
 * good batch, and the API's messageKey check makes any re-sent row a no-op.
 */
export async function syncInbox(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now?.() ?? Date.now();
  let since = deps.watermark() ?? now - FIRST_SYNC_DAYS * 86_400_000;
  const total: SyncResult = { read: 0, found: 0, unrecognised: 0, created: 0, merged: 0, skipped: 0, rejected: 0 };
  const expected = deps.onProgress && deps.countInbox ? await deps.countInbox(since) : null;
  if (expected !== null) deps.onProgress!(0, expected);

  const active = deps.active ?? (() => true);
  for (;;) {
    if (!active()) break;
    const page = await deps.readInbox(since, READ_PAGE);
    if (page.length === 0) break;
    total.read += page.length;
    const pending: { item: CapturedTxn; receivedAt: number }[] = [];
    for (const m of page) {
      const parsed = toCaptured(m);
      if (!parsed) {
        if (!isNotAPayment(m.body)) total.unrecognised++;
        continue;
      }
      total.found++;
      const item = sendable(parsed, now);
      if (item) pending.push({ item, receivedAt: m.receivedAt });
      else total.rejected++;
    }
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      if (!active()) return total;
      const chunk = pending.slice(i, i + BATCH_SIZE);
      const result = await sendChunk(deps, chunk.map((c) => c.item));
      total.created += result.created;
      total.merged += result.merged;
      total.skipped += result.skipped;
      total.rejected += result.rejected;
      if (!active()) return total;
      deps.setWatermark(chunk[chunk.length - 1]!.receivedAt);
    }
    if (!active()) return total;
    // The whole page is handled (non-payments included): move past it.
    since = page[page.length - 1]!.receivedAt;
    deps.setWatermark(since);
    // More can arrive while it runs; the total grows rather than the bar passing 100%.
    if (expected !== null) deps.onProgress!(total.read, Math.max(expected, total.read));
    if (page.length < READ_PAGE) break;
  }
  return total;
}
