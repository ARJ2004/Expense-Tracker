import { MAX_AMOUNT_PAISE } from '@et/domain';
import { parseSms, smsMessageKey } from '@et/parsers';
import type { CapturedTxn, IngestBatchResult } from '@et/api-client';
import type { InboxMessage } from '../../native/NativeSmsInbox';

/** The API takes at most this many rows per call. */
export const BATCH_SIZE = 100;
/** Inbox messages read per native call; the loop pages until the inbox is caught up. */
export const READ_PAGE = 500;
/** First sync looks back this far (statement imports cover anything older). */
export const FIRST_SYNC_DAYS = 90;
/** The API counts a row dated further ahead than this as rejected (a phone clock far off). */
const MAX_FUTURE_MS = 86_400_000;

export interface SyncDeps {
  readInbox(sinceMs: number, limit: number): Promise<InboxMessage[]>;
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
}

/**
 * The row as the API will accept it (the same limits as CapturedTxnDto): an optional field that
 * doesn't fit is left out, so the payment still counts; a row with no usable amount, bank or time
 * is null. Without this, one odd message would fail its whole batch on every sync.
 */
export function sendable(item: CapturedTxn, now: number): CapturedTxn | null {
  if (!Number.isInteger(item.amountPaise) || item.amountPaise < 1 || item.amountPaise > MAX_AMOUNT_PAISE) return null;
  if (item.bank.length < 1 || item.bank.length > 60) return null;
  const at = Date.parse(item.occurredAt);
  if (!Number.isFinite(at) || at > now + MAX_FUTURE_MS) return null;
  const out: CapturedTxn = { ...item };
  if (out.last4 !== undefined && !/^\d{3,4}$/.test(out.last4)) delete out.last4;
  if (out.counterparty !== undefined && (out.counterparty.length < 1 || out.counterparty.length > 80)) delete out.counterparty;
  if (out.referenceNo !== undefined && !/^[A-Za-z0-9]{6,22}$/.test(out.referenceNo)) delete out.referenceNo;
  if (out.narration !== undefined && !/^[A-Z ]{1,24}$/.test(out.narration)) delete out.narration;
  return out;
}

/**
 * Sends one batch. If the API still refuses it as invalid, each row is sent on its own and the
 * refused ones are counted as rejected, so the watermark always moves past a bad message.
 */
async function sendChunk(deps: SyncDeps, items: CapturedTxn[]): Promise<IngestBatchResult> {
  try {
    return await deps.send(items);
  } catch (e) {
    if (!isValidationError(e) || items.length === 1) {
      if (isValidationError(e)) return { created: 0, merged: 0, skipped: 0, rejected: 1 };
      throw e;
    }
  }
  const total: IngestBatchResult = { created: 0, merged: 0, skipped: 0, rejected: 0 };
  for (const item of items) {
    const r = await sendChunk(deps, [item]);
    total.created += r.created;
    total.merged += r.merged;
    total.skipped += r.skipped;
    total.rejected += r.rejected;
  }
  return total;
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
    messageKey: smsMessageKey(message.sender, receivedAt, message.body),
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
  const total: SyncResult = { read: 0, found: 0, created: 0, merged: 0, skipped: 0, rejected: 0 };

  for (;;) {
    const page = await deps.readInbox(since, READ_PAGE);
    if (page.length === 0) break;
    total.read += page.length;
    const pending: { item: CapturedTxn; receivedAt: number }[] = [];
    for (const m of page) {
      const parsed = toCaptured(m);
      if (!parsed) continue;
      total.found++;
      const item = sendable(parsed, now);
      if (item) pending.push({ item, receivedAt: m.receivedAt });
      else total.rejected++;
    }
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const chunk = pending.slice(i, i + BATCH_SIZE);
      const result = await sendChunk(deps, chunk.map((c) => c.item));
      total.created += result.created;
      total.merged += result.merged;
      total.skipped += result.skipped;
      total.rejected += result.rejected;
      deps.setWatermark(chunk[chunk.length - 1]!.receivedAt);
    }
    // The whole page is handled (non-payments included): move past it.
    since = page[page.length - 1]!.receivedAt;
    deps.setWatermark(since);
    if (page.length < READ_PAGE) break;
  }
  return total;
}
