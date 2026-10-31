import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { Direction, NormalizedTxn } from '@et/domain';
import { AccountsService } from '../accounts';
import { CategoriesService } from '../categories';
import { AppError, PrismaService } from '../common';
import { firstMatch } from './domain/pipeline';
import { CATEGORY_RULES, DEDUP_RULES, TYPE_RULES } from './domain/rules';
import { sourceHash, type SourceInput } from './domain/source-input';
import { TRANSACTION_CREATED, TRANSACTION_DELETED, TRANSACTION_UPDATED, type TransactionEvent } from './ingest.events';

export interface IngestResult {
  transactionId: string;
  /** False when this exact source was seen before (idempotent replay). */
  created: boolean;
}

/** Fields a user may change; null clears an optional field. */
export interface TransactionPatch {
  amountPaise?: number;
  direction?: Direction;
  occurredAt?: Date;
  accountId?: string | null;
  categoryId?: string;
  merchantName?: string | null;
  note?: string | null;
}

/**
 * The only writer of transactions and transaction_sources. Every source builds a NormalizedTxn
 * and calls ingest(); edits and deletes from the app come through here too.
 */
@Injectable()
export class IngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly categories: CategoriesService,
    private readonly events: EventEmitter2,
  ) {}

  async ingest(userId: string, txn: NormalizedTxn, source: SourceInput): Promise<IngestResult> {
    const hash = sourceHash(userId, source);
    const normalized = await this.normalize(userId, txn);

    let result: IngestResult;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // 1. Idempotency: the same raw input twice returns the first transaction.
        const seen = await tx.transactionSource.findUnique({ where: { userId_sourceHash: { userId, sourceHash: hash } } });
        if (seen) return { transactionId: seen.transactionId, created: false };

        // 2. Dedup: no rules yet for manual entries (see DEDUP_RULES).
        if (DEDUP_RULES.length > 0) throw new Error('Dedup candidates are not wired yet');

        // 3. Categorize and classify.
        const category = firstMatch(CATEGORY_RULES, (r) => r.apply(normalized))!;
        const type = firstMatch(TYPE_RULES, (r) => r.classify(normalized))!;

        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: normalized.accountId ?? null,
            amountPaise: BigInt(normalized.amountPaise),
            direction: normalized.direction,
            type,
            occurredAt: normalized.occurredAt,
            merchantName: normalized.counterparty ?? null,
            categoryId: category.categoryId,
            categorySource: category.source,
            referenceNo: normalized.referenceNo ?? null,
            note: normalized.note ?? null,
            sources: {
              create: {
                userId,
                source: normalized.source,
                sourceHash: hash,
                rawText: normalized.rawText ?? null,
                receivedAt: new Date(),
              },
            },
          },
        });
        return { transactionId: created.id, created: true };
      });
    } catch (e) {
      // A concurrent replay of the same source won the insert.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const seen = await this.prisma.transactionSource.findUniqueOrThrow({ where: { userId_sourceHash: { userId, sourceHash: hash } } });
        return { transactionId: seen.transactionId, created: false };
      }
      throw e;
    }

    if (result.created) this.emit(TRANSACTION_CREATED, userId, result.transactionId);
    return result;
  }

  /**
   * Applies a user's edit. Changing amount, date or merchant sets user_edited so later sources
   * never overwrite it; picking a category makes it category_source = user.
   */
  async edit(userId: string, id: string, patch: TransactionPatch): Promise<void> {
    const current = await this.prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
    if (!current) throw notFound();
    if (patch.accountId) await this.accounts.assertOwned(userId, patch.accountId);
    if (patch.categoryId) await this.categories.assertUsable(userId, patch.categoryId);

    const data: Prisma.TransactionUpdateInput = {};
    let userEdited = current.userEdited;
    if (patch.amountPaise !== undefined && BigInt(patch.amountPaise) !== current.amountPaise) {
      data.amountPaise = BigInt(patch.amountPaise);
      userEdited = true;
    }
    if (patch.occurredAt && patch.occurredAt.getTime() !== current.occurredAt.getTime()) {
      data.occurredAt = patch.occurredAt;
      userEdited = true;
    }
    if (patch.merchantName !== undefined && patch.merchantName !== current.merchantName) {
      data.merchantName = patch.merchantName;
      userEdited = true;
    }
    if (patch.note !== undefined) data.note = patch.note;
    if (patch.accountId !== undefined) {
      data.account = patch.accountId ? { connect: { id: patch.accountId } } : { disconnect: true };
    }

    const direction = patch.direction ?? current.direction;
    if (patch.direction && patch.direction !== current.direction) {
      data.direction = patch.direction;
      data.type = firstMatch(TYPE_RULES, (r) => r.classify(this.asTxn(direction)))!;
    }
    if (patch.categoryId && patch.categoryId !== current.categoryId) {
      data.category = { connect: { id: patch.categoryId } };
      data.categorySource = 'user';
    } else if (!patch.categoryId && data.direction && current.categorySource === 'default') {
      // A default category follows the direction (Other ↔ Income).
      data.category = { connect: { id: firstMatch(CATEGORY_RULES, (r) => r.apply(this.asTxn(direction)))!.categoryId } };
    }
    if (userEdited !== current.userEdited) data.userEdited = userEdited;

    if (Object.keys(data).length > 0) await this.prisma.transaction.update({ where: { id }, data });
    this.emit(TRANSACTION_UPDATED, userId, id);
  }

  /** Soft delete; the source rows stay so the same input arriving again does not revive it. */
  async softDelete(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw notFound();
    this.emit(TRANSACTION_DELETED, userId, id);
  }

  /** Step 0: check ownership of what the user picked; resolve an account hint for automatic sources. */
  private async normalize(userId: string, txn: NormalizedTxn): Promise<NormalizedTxn> {
    if (txn.accountId) await this.accounts.assertOwned(userId, txn.accountId);
    if (txn.categoryId) await this.categories.assertUsable(userId, txn.categoryId);
    let accountId = txn.accountId;
    if (!accountId && txn.accountHint) accountId = (await this.accounts.resolve(userId, txn.accountHint))?.id;
    const counterparty = txn.counterparty?.trim() || undefined;
    const note = txn.note?.trim() || undefined;
    return { ...txn, accountId, counterparty, note };
  }

  private asTxn(direction: Direction): NormalizedTxn {
    return { source: 'manual', amountPaise: 1 as NormalizedTxn['amountPaise'], direction, occurredAt: new Date(), timePrecision: 'minute' };
  }

  private emit(event: string, userId: string, transactionId: string): void {
    this.events.emit(event, { userId, transactionId } satisfies TransactionEvent);
  }
}

function notFound(): AppError {
  return new AppError('NOT_FOUND', 'Transaction not found', HttpStatus.NOT_FOUND);
}
