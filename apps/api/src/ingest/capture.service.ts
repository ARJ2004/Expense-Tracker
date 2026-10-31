import { Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts';
import { capturedToIngest, hintKey, type CapturedTxn } from './domain/captured-txn';
import { IngestService, type BatchItem, type BatchResult } from './ingest.service';

export interface CaptureResult extends BatchResult {
  /** Rows refused one by one (dated more than a day ahead); the rest of the batch still goes in. */
  rejected: number;
}

/**
 * Rows the phone captured (bank SMS now, notifications in v0.3): resolves each row's account from
 * its bank and last digits (creating "HDFC Bank ••1234" the first time), then hands the batch to
 * IngestService.ingestBatch, so idempotency, dedup against statements and categorization are the
 * same as every other source.
 */
@Injectable()
export class CaptureService {
  constructor(
    private readonly ingest: IngestService,
    private readonly accounts: AccountsService,
  ) {}

  /**
   * A row dated more than a day ahead (a phone clock far off) is counted as rejected instead of
   * failing the batch: one bad message must never stop the phone's sync from moving past it.
   */
  async ingestCaptured(userId: string, captured: readonly CapturedTxn[]): Promise<CaptureResult> {
    const now = new Date();
    const items: BatchItem[] = [];
    let rejected = 0;
    for (const c of captured) {
      try {
        items.push(capturedToIngest(c, now));
      } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        rejected++;
      }
    }
    if (items.length === 0) return { created: 0, merged: 0, skipped: 0, rejected };

    const accountIds = new Map<string, string | null>();
    for (const item of items) {
      const hint = item.txn.accountHint;
      if (!hint) continue;
      const key = hintKey(hint);
      if (!accountIds.has(key)) accountIds.set(key, (await this.accounts.resolve(userId, hint))?.id ?? null);
      const accountId = accountIds.get(key);
      if (accountId) item.txn.accountId = accountId;
    }
    return { ...(await this.ingest.ingestBatch(userId, items)), rejected };
  }
}
