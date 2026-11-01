import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { merchantKey, OTHER_CATEGORY_ID, type CategorySource, type Direction, type NormalizedTxn, type TxnType } from '@et/domain';
import { AccountsService } from '../accounts';
import { CategoriesService, CategorizerService } from '../categories';
import { AppError, PrismaService, uuidv7 } from '../common';
import { tunables } from '../config/tunables';
import { firstMatch, type CategoryHit, type DedupCandidate, type DedupMatch, type TypeContext } from './domain/pipeline';
import { CATEGORY_RULES, DEDUP_RULES, FALLBACK_CATEGORY, TYPE_RULES } from './domain/rules';
import { categoryForType } from './domain/rules/type-category';
import { sourceHash, type SourceInput } from './domain/source-input';
import {
  TRANSACTION_CREATED,
  TRANSACTION_DELETED,
  TRANSACTION_UPDATED,
  TRANSACTIONS_INGESTED,
  TRANSACTIONS_RECATEGORIZED,
  type TransactionEvent,
  type TransactionsIngestedEvent,
  type TransactionsRecategorizedEvent,
} from './ingest.events';

type Db = Prisma.TransactionClient;

/** Dedup rule 4's window, plus a day for the IST/UTC boundary. */
const CANDIDATE_WINDOW_MS = (tunables.dedup.possibleDuplicateDays + 1) * 86_400_000;

export interface IngestResult {
  transactionId: string;
  /** False when this exact source was seen before (idempotent replay). */
  created: boolean;
}

export interface RecategorizeResult {
  /** Other rows from the same merchant that moved too. */
  updatedCount: number;
}

/** A row from an automatic source, with what makes it idempotent. */
export interface IngestItem {
  /** accountId, when set, must already be checked as the user's. */
  txn: NormalizedTxn;
  source: SourceInput;
}

/** What ingest would do with a row, without writing anything. */
export interface DryRunRow {
  /** null: new. merge: already in the ledger (rule "source" means this exact row was imported). flag: possible duplicate. */
  match: DedupMatch | null;
  category: CategoryHit;
  type: TxnType;
}

export interface BatchItem extends IngestItem {
  /** Category decided at review; computed by the rules when absent. */
  category?: CategoryHit;
  /** The user ticked a row the dry run called a duplicate: create it as new without dedup. */
  skipDedup?: boolean;
}

export interface BatchOptions {
  /** Stored on each new transaction_sources row. */
  importId?: string;
  /** Runs inside the same database transaction after the rows are written (the caller's own bookkeeping). */
  within?: (tx: Db, result: BatchResult) => Promise<void>;
}

export interface BatchResult {
  created: number;
  /** Attached to an existing transaction by a dedup rule. */
  merged: number;
  /** This exact row was ingested before. */
  skipped: number;
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
    private readonly categorizer: CategorizerService,
    private readonly events: EventEmitter2,
  ) {}

  async ingest(userId: string, txn: NormalizedTxn, source: SourceInput): Promise<IngestResult> {
    const hash = sourceHash(userId, source);
    const normalized = await this.normalize(userId, txn);
    const key = merchantKey(normalized.counterparty);
    // Categorize before the write transaction: it only reads (the user's merchant rule).
    const category = await this.categorize(userId, normalized, key);

    let result: IngestResult;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // 1. Idempotency: the same raw input twice returns the first transaction.
        const seen = await tx.transactionSource.findUnique({ where: { userId_sourceHash: { userId, sourceHash: hash } } });
        if (seen) return { transactionId: seen.transactionId, created: false };

        // 2. Dedup: a manual entry is never merged on the way in (see DEDUP_RULES).

        // 3. Classify (the category was picked above).
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
            merchantKey: key,
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
   * What ingestBatch would do with each row: already imported, merged by a dedup rule, flagged as a
   * possible duplicate, or new; and the category and type it would get. Reads only.
   */
  async dryRun(userId: string, items: readonly IngestItem[]): Promise<DryRunRow[]> {
    if (items.length === 0) return [];
    const hashes = items.map((i) => sourceHash(userId, i.source));
    const [seen, candidates, categories, typeCtx] = await Promise.all([
      this.seenSources(this.prisma, userId, hashes),
      this.loadCandidates(this.prisma, userId, items.map((i) => i.txn)),
      this.categorizeMany(userId, items.map((i) => i.txn)),
      this.typeContext(userId),
    ]);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    return items.map((item, i) => {
      const previous = seen.get(hashes[i]!);
      const match: DedupMatch | null = previous
        ? { transactionId: previous, action: 'merge', rule: 'source' }
        : firstMatch(DEDUP_RULES, (r) => r.find(item.txn, candidates));
      // As in ingestBatch: once merged, the same-kind guard keeps later rows off that transaction.
      if (match?.action === 'merge') byId.get(match.transactionId)?.sourceKinds.push(item.txn.source);
      const type = this.classify(item.txn, typeCtx);
      return { match, category: categoryForType(categories[i]!, type), type };
    });
  }

  /**
   * Writes many automatic rows in one database transaction (a confirmed statement import): rows
   * seen before are skipped, dedup merges attach a source to the existing transaction (filling
   * only its empty fields, never the user's), and everything else is bulk-inserted.
   */
  async ingestBatch(userId: string, items: readonly BatchItem[], options: BatchOptions = {}): Promise<BatchResult> {
    const accountIds = [...new Set(items.map((i) => i.txn.accountId).filter((id): id is string => !!id))];
    await Promise.all(accountIds.map((id) => this.accounts.assertOwned(userId, id)));
    const hashes = items.map((i) => sourceHash(userId, i.source));
    const keys = items.map((i) => merchantKey(i.txn.counterparty));
    const missing = items.map((item, i) => (item.category ? null : i)).filter((i): i is number => i !== null);
    const computed = await this.categorizeMany(userId, missing.map((i) => items[i]!.txn));
    const categories = items.map((item) => item.category);
    missing.forEach((i, n) => (categories[i] = computed[n]));
    const typeCtx = await this.typeContext(userId);
    const receivedAt = new Date();

    const createdIds: string[] = [];
    const merges: { candidate: DedupCandidate; txn: NormalizedTxn }[] = [];
    const result = await this.prisma.$transaction(
      async (tx) => {
        const seen = await this.seenSources(tx, userId, hashes);
        const candidates = await this.loadCandidates(tx, userId, items.map((i) => i.txn));
        const byId = new Map(candidates.map((c) => [c.id, c]));
        const transactions: Prisma.TransactionCreateManyInput[] = [];
        const sources: Prisma.TransactionSourceCreateManyInput[] = [];
        const done = new Set<string>();
        let skipped = 0;

        items.forEach((item, i) => {
          const hash = hashes[i]!;
          if (seen.has(hash) || done.has(hash)) {
            skipped++;
            return;
          }
          done.add(hash);
          const { txn } = item;
          const source = { userId, source: txn.source, sourceHash: hash, rawText: txn.rawText ?? null, importId: options.importId ?? null, receivedAt };
          const match = item.skipDedup ? null : firstMatch(DEDUP_RULES, (r) => r.find(txn, candidates));
          if (match?.action === 'merge') {
            const candidate = byId.get(match.transactionId)!;
            // It now has this kind of source, so the same-kind guard keeps a second row off it.
            candidate.sourceKinds.push(txn.source);
            sources.push({ ...source, transactionId: candidate.id });
            merges.push({ candidate, txn });
            return;
          }
          const id = uuidv7(receivedAt.getTime());
          const type = this.classify(txn, typeCtx);
          const category = categoryForType(categories[i]!, type);
          transactions.push({
            id,
            userId,
            accountId: txn.accountId ?? null,
            amountPaise: BigInt(txn.amountPaise),
            direction: txn.direction,
            type,
            occurredAt: txn.occurredAt,
            merchantName: txn.counterparty ?? null,
            merchantKey: keys[i],
            categoryId: category.categoryId,
            categorySource: category.source,
            referenceNo: txn.referenceNo ?? null,
            note: txn.note ?? null,
          });
          sources.push({ ...source, transactionId: id });
          createdIds.push(id);
        });

        if (transactions.length > 0) await tx.transaction.createMany({ data: transactions });
        if (sources.length > 0) await tx.transactionSource.createMany({ data: sources });
        // A merge fills only what the existing transaction lacks; amount, merchant and category stay.
        for (const { candidate, txn } of merges) {
          const data = fillEmpty(candidate, txn);
          if (!data) continue;
          await tx.transaction.update({ where: { id: candidate.id }, data });
          Object.assign(candidate, data);
        }

        const outcome: BatchResult = { created: createdIds.length, merged: merges.length, skipped };
        if (options.within) await options.within(tx, outcome);
        return outcome;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    const mergedIds = [...new Set(merges.map((m) => m.candidate.id))];
    if (createdIds.length > 0 || mergedIds.length > 0) {
      this.events.emit(TRANSACTIONS_INGESTED, { userId, createdIds, mergedIds } satisfies TransactionsIngestedEvent);
    }
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
    const merchantChanged = patch.merchantName !== undefined && patch.merchantName !== current.merchantName;
    if (merchantChanged) {
      data.merchantName = patch.merchantName;
      data.merchantKey = merchantKey(patch.merchantName);
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
    } else if (!patch.categoryId && current.categorySource !== 'user' && (merchantChanged || data.direction)) {
      // An automatic category follows the merchant and direction (a new name, Other ↔ Income).
      const merchant = merchantChanged ? (patch.merchantName ?? undefined) : (current.merchantName ?? undefined);
      const hit = await this.categorize(userId, { ...this.asTxn(direction), counterparty: merchant }, merchantKey(merchant));
      if (hit.categoryId !== current.categoryId) data.category = { connect: { id: hit.categoryId } };
      if (hit.source !== current.categorySource) data.categorySource = hit.source;
    }
    if (userEdited !== current.userEdited) data.userEdited = userEdited;

    if (Object.keys(data).length > 0) await this.prisma.transaction.update({ where: { id }, data });
    this.emit(TRANSACTION_UPDATED, userId, id);
  }

  /**
   * The user picked a category on Detail. With applyToMerchant it also saves a merchant rule
   * (future rows) and moves the user's other rows from that merchant, except ones they
   * categorized by hand. Every correction is logged for the global rule list.
   */
  async recategorize(userId: string, id: string, categoryId: string, applyToMerchant: boolean): Promise<RecategorizeResult> {
    const current = await this.prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
    if (!current) throw notFound();
    await this.categories.assertUsable(userId, categoryId);
    const key = current.merchantKey;
    if (applyToMerchant && (!key || !current.merchantName)) {
      throw new AppError('MERCHANT_REQUIRED', 'This transaction has no merchant to apply the category to', HttpStatus.BAD_REQUEST);
    }

    const movedIds = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({ where: { id }, data: { categoryId, categorySource: 'user' } });
      let others: string[] = [];
      if (applyToMerchant && key && current.merchantName) {
        await this.categorizer.saveMerchantRule(userId, key, current.merchantName, categoryId, tx);
        const rows = await tx.transaction.findMany({
          where: {
            userId,
            merchantKey: key,
            deletedAt: null,
            id: { not: id },
            categorySource: { not: 'user' },
            OR: [{ categoryId: { not: categoryId } }, { categoryId: null }, { categorySource: 'default' }],
          },
          select: { id: true },
        });
        others = rows.map((r) => r.id);
        if (others.length > 0) {
          await tx.transaction.updateMany({ where: { id: { in: others } }, data: { categoryId, categorySource: 'rule' } });
        }
      }
      await this.categorizer.logCorrection(
        userId,
        { merchantKey: key, fromCategoryId: current.categoryId, toCategoryId: categoryId, appliedToAll: applyToMerchant },
        tx,
      );
      return others;
    });

    this.emit(TRANSACTION_UPDATED, userId, id);
    if (movedIds.length > 0) {
      this.events.emit(TRANSACTIONS_RECATEGORIZED, { userId, transactionIds: movedIds } satisfies TransactionsRecategorizedEvent);
    }
    return { updatedCount: movedIds.length };
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

  /** The user's pick, else the categorizer's rules, else Income / Other. */
  private async categorize(
    userId: string,
    txn: NormalizedTxn,
    key: string | null,
  ): Promise<{ categoryId: string; source: CategorySource }> {
    const picked = firstMatch(CATEGORY_RULES, (r) => r.apply(txn));
    if (picked) return picked;
    const match = await this.categorizer.categorize(userId, { merchantKey: key, narration: txn.narration ?? null, direction: txn.direction });
    return match ? { categoryId: match.categoryId, source: 'rule' } : FALLBACK_CATEGORY.apply(txn);
  }

  /** categorize() for many rows; the user's merchant rules are read once. */
  private async categorizeMany(userId: string, txns: readonly NormalizedTxn[]): Promise<CategoryHit[]> {
    const matches = await this.categorizer.categorizeMany(
      userId,
      txns.map((t) => ({ merchantKey: merchantKey(t.counterparty), narration: t.narration ?? null, direction: t.direction })),
    );
    return txns.map((t, i) => firstMatch(CATEGORY_RULES, (r) => r.apply(t)) ?? (matches[i] ? { categoryId: matches[i].categoryId, source: 'rule' } : FALLBACK_CATEGORY.apply(t)));
  }

  private classify(txn: NormalizedTxn, ctx: TypeContext): TxnType {
    return firstMatch(TYPE_RULES, (r) => r.classify(txn, ctx))!;
  }

  /** Last 4 of the user's accounts, so a transfer to "XXXXXX1234" is seen as their own. */
  private async typeContext(userId: string): Promise<TypeContext> {
    const accounts = await this.accounts.list(userId);
    return { ownAccountLast4: accounts.map((a) => a.maskedNumber).filter((m): m is string => !!m) };
  }

  /** source_hash → transaction id for hashes already ingested. */
  private async seenSources(db: Db, userId: string, hashes: readonly string[]): Promise<Map<string, string>> {
    const rows = await db.transactionSource.findMany({
      where: { userId, sourceHash: { in: [...new Set(hashes)] } },
      select: { sourceHash: true, transactionId: true },
    });
    return new Map(rows.map((r) => [r.sourceHash, r.transactionId]));
  }

  /**
   * A custom category is being deleted: file its transactions under Other (the fallback for a debit
   * or a credit alike once the user's own category is gone). Runs in the caller's transaction, so
   * the move commits with the delete. Returns the moved ids; the caller announces them with
   * announceRecategorized once that transaction commits.
   */
  async moveOutOfCategory(userId: string, categoryId: string, tx: Db): Promise<string[]> {
    const rows = await tx.transaction.findMany({ where: { userId, categoryId }, select: { id: true } });
    if (rows.length === 0) return [];
    await tx.transaction.updateMany({ where: { userId, categoryId }, data: { categoryId: OTHER_CATEGORY_ID, categorySource: 'default' } });
    return rows.map((r) => r.id);
  }

  /** Emits TRANSACTIONS_RECATEGORIZED for rows moved inside a transaction that has now committed. */
  announceRecategorized(userId: string, transactionIds: string[]): void {
    this.events.emit(TRANSACTIONS_RECATEGORIZED, { userId, transactionIds } satisfies TransactionsRecategorizedEvent);
  }

  /** Deletes the user's transactions and their sources (account deletion). Runs in the purge's transaction. */
  async purgeUser(userId: string, tx: Db): Promise<void> {
    await tx.transactionSource.deleteMany({ where: { userId } });
    await tx.transaction.deleteMany({ where: { userId } });
  }

  /** Live transactions that any dedup rule could match: same amounts, within rule 4's window. */
  private async loadCandidates(db: Db, userId: string, txns: readonly NormalizedTxn[]): Promise<DedupCandidate[]> {
    if (txns.length === 0) return [];
    const times = txns.map((t) => t.occurredAt.getTime());
    const amounts = [...new Set(txns.map((t) => t.amountPaise))].map((a) => BigInt(a));
    const rows = await db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        amountPaise: { in: amounts },
        occurredAt: { gte: new Date(Math.min(...times) - CANDIDATE_WINDOW_MS), lte: new Date(Math.max(...times) + CANDIDATE_WINDOW_MS) },
      },
      select: {
        id: true,
        amountPaise: true,
        direction: true,
        occurredAt: true,
        accountId: true,
        referenceNo: true,
        merchantName: true,
        sources: { select: { source: true } },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      amountPaise: Number(r.amountPaise),
      direction: r.direction,
      occurredAt: r.occurredAt,
      accountId: r.accountId,
      referenceNo: r.referenceNo,
      merchantName: r.merchantName,
      sourceKinds: r.sources.map((s) => s.source),
    }));
  }

  private asTxn(direction: Direction): NormalizedTxn {
    return { source: 'manual', amountPaise: 1 as NormalizedTxn['amountPaise'], direction, occurredAt: new Date(), timePrecision: 'minute' };
  }

  private emit(event: string, userId: string, transactionId: string): void {
    this.events.emit(event, { userId, transactionId } satisfies TransactionEvent);
  }
}

/** The fields a merged source may add to an existing transaction: only ones it lacks. */
function fillEmpty(existing: DedupCandidate, txn: NormalizedTxn): Prisma.TransactionUncheckedUpdateInput | null {
  const data: Prisma.TransactionUncheckedUpdateInput = {};
  if (!existing.referenceNo && txn.referenceNo) data.referenceNo = txn.referenceNo;
  if (!existing.accountId && txn.accountId) data.accountId = txn.accountId;
  if (!existing.merchantName && txn.counterparty) {
    data.merchantName = txn.counterparty;
    data.merchantKey = merchantKey(txn.counterparty);
  }
  return Object.keys(data).length > 0 ? data : null;
}

function notFound(): AppError {
  return new AppError('NOT_FOUND', 'Transaction not found', HttpStatus.NOT_FOUND);
}
