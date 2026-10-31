import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type ImportRow, type StatementImport } from '@prisma/client';
import { balanceBreaks, pickStatementAdapter, type ParsedStatement } from '@et/parsers';
import { AccountsService, type AccountDto } from '../accounts';
import { CategoriesService } from '../categories';
import { AppError, PrismaService } from '../common';
import { IngestService, statementRowKey, type BatchItem } from '../ingest';
import { sniffFormat } from './domain/file-sniff';
import { readSheet, SheetError } from './domain/sheet-reader';
import { dayOf, editsOf, istMidnight, toNormalizedTxn, toSourceInput, type RowEdits } from './domain/statement-row';
import type { ImportDto, ImportRowDto, RowFilter, UpdateImportRowDto } from './dto/import.dto';
import { ImportQueue } from './import-queue';
import { IMPORT_CONFIRMED, type ImportConfirmedEvent } from './imports.events';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

type ImportWithAccount = StatementImport & { account: AccountRow | null };
type AccountRow = { id: string; bankName: string; maskedNumber: string | null };
type RowWithCategory = ImportRow & { category: { id: string; name: string; icon: string; color: string } | null };

const RECENT_IMPORTS = 20;

/**
 * Owns statement_imports and import_rows: upload → parse (background job) → dry run → review →
 * confirm. Transactions are written only through IngestService.ingestBatch.
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly categories: CategoriesService,
    private readonly ingest: IngestService,
    private readonly queue: ImportQueue,
    private readonly events: EventEmitter2,
  ) {}

  async upload(userId: string, file: UploadedFile, accountId?: string): Promise<{ import: ImportDto; alreadyImportedAt?: string }> {
    const format = sniffFormat(file.buffer);
    if (format === 'unsupported') throw new AppError('IMPORT_UNSUPPORTED_FORMAT', 'Upload a CSV, Excel (.xlsx) or PDF statement', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    if (accountId) await this.accounts.assertOwned(userId, accountId);

    const fileSha256 = createHash('sha256').update(file.buffer).digest('hex');
    const previous = await this.prisma.statementImport.findFirst({
      where: { userId, fileSha256, status: 'imported' },
      orderBy: { confirmedAt: 'desc' },
      select: { confirmedAt: true },
    });
    const created = await this.prisma.statementImport.create({
      data: { userId, fileName: safeFileName(file.originalname), fileSha256, fileBytes: file.buffer, format, accountId: accountId ?? null },
      select: { id: true },
    });
    await this.queue.send({ importId: created.id });
    return {
      import: await this.get(userId, created.id),
      ...(previous?.confirmedAt ? { alreadyImportedAt: previous.confirmedAt.toISOString() } : {}),
    };
  }

  async list(userId: string): Promise<ImportDto[]> {
    const rows = await this.prisma.statementImport.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_IMPORTS,
      include: { account: { select: accountSelect } },
    });
    const counts = await this.rowCounts(rows.map((r) => r.id));
    return rows.map((r) => toImportDto(r, counts.get(r.id)));
  }

  async get(userId: string, id: string): Promise<ImportDto> {
    const row = await this.find(userId, id);
    const counts = await this.rowCounts([id]);
    return toImportDto(row, counts.get(id));
  }

  async rows(userId: string, id: string, filter: RowFilter = 'all'): Promise<ImportRowDto[]> {
    await this.find(userId, id);
    const rows = await this.prisma.importRow.findMany({
      where: { importId: id, ...rowFilter(filter) },
      orderBy: { rowNo: 'asc' },
      include: { category: { select: categorySelect } },
    });
    return rows.map(toRowDto);
  }

  async updateRow(userId: string, id: string, rowNo: number, dto: UpdateImportRowDto): Promise<ImportRowDto> {
    const imp = await this.findInReview(userId, id);
    const row = await this.prisma.importRow.findUnique({ where: { importId_rowNo: { importId: id, rowNo } } });
    if (!row) throw new AppError('NOT_FOUND', 'Row not found', HttpStatus.NOT_FOUND);
    if (dto.categoryId) await this.categories.assertUsable(userId, dto.categoryId);

    const edits: RowEdits = { ...editsOf(row) };
    if (dto.amountPaise !== undefined) edits.amountPaise = dto.amountPaise;
    if (dto.occurredOn !== undefined) {
      if (Number.isNaN(istMidnight(dto.occurredOn).getTime())) throw new AppError('VALIDATION_FAILED', 'occurredOn is not a date', HttpStatus.BAD_REQUEST);
      edits.occurredOn = dto.occurredOn;
    }
    if (dto.merchantName !== undefined) edits.merchantName = dto.merchantName?.trim() || null;
    const fieldsChanged = JSON.stringify(edits) !== JSON.stringify(editsOf(row));

    await this.prisma.importRow.update({
      where: { id: row.id },
      data: {
        ...(dto.action ? { action: dto.action } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId, categorySource: 'user' } : {}),
        ...(fieldsChanged ? { editedJson: edits as Prisma.InputJsonValue } : {}),
        edited: dto.action !== undefined || fieldsChanged || row.edited,
      },
    });
    // A new amount, day or merchant can change what the row matches in the ledger.
    if (fieldsChanged) await this.runDryRun(userId, imp);

    const updated = await this.prisma.importRow.findUniqueOrThrow({ where: { id: row.id }, include: { category: { select: categorySelect } } });
    return toRowDto(updated);
  }

  /** The user picked the account; dedup rule 2 depends on it, so the dry run runs again. */
  async setAccount(userId: string, id: string, accountId: string): Promise<ImportDto> {
    await this.findInReview(userId, id);
    await this.accounts.assertOwned(userId, accountId);
    const updated = await this.prisma.statementImport.update({ where: { id }, data: { accountId }, include: { account: { select: accountSelect } } });
    await this.runDryRun(userId, updated);
    return this.get(userId, id);
  }

  /**
   * Adds the ticked rows in one database transaction. Rows already in the ledger merge into
   * their transaction (adding this statement as a source); a ticked duplicate is added as new.
   */
  async confirm(userId: string, id: string): Promise<ImportDto> {
    const imp = await this.findInReview(userId, id);
    if (!imp.accountId) throw new AppError('ACCOUNT_REQUIRED', 'Pick the account this statement is for', HttpStatus.CONFLICT);
    const rows = await this.prisma.importRow.findMany({ where: { importId: id }, orderBy: { rowNo: 'asc' } });

    const items: BatchItem[] = [];
    for (const row of rows) {
      const ticked = row.action === 'import';
      const merges = row.duplicateOf !== null && row.flag !== 'possible_duplicate' && row.matchRule !== 'source';
      if (!ticked && !merges) continue;
      items.push({
        txn: toNormalizedTxn(row, imp.accountId),
        source: toSourceInput(row),
        ...(row.categoryId ? { category: { categoryId: row.categoryId, source: row.categorySource } } : {}),
        // Ticked although the dry run matched it: the user says it is a separate payment.
        skipDedup: ticked && row.duplicateOf !== null,
      });
    }

    const result = await this.ingest.ingestBatch(userId, items, {
      importId: id,
      within: async (tx, outcome) => {
        const { count } = await tx.statementImport.updateMany({
          where: { id, userId, status: 'review' },
          data: { status: 'imported', importedCount: outcome.created, mergedCount: outcome.merged, confirmedAt: new Date() },
        });
        // Confirmed concurrently: roll this one back.
        if (count === 0) throw notInReview();
      },
    });
    this.events.emit(IMPORT_CONFIRMED, { userId, importId: id, created: result.created, merged: result.merged } satisfies ImportConfirmedEvent);
    return this.get(userId, id);
  }

  /** Discards an import that was not added; its staged rows go with it. */
  async discard(userId: string, id: string): Promise<void> {
    const imp = await this.find(userId, id);
    if (imp.status === 'imported') throw new AppError('IMPORT_ALREADY_CONFIRMED', 'This import was already added to the ledger', HttpStatus.CONFLICT);
    await this.prisma.statementImport.deleteMany({ where: { id, userId, status: { not: 'imported' } } });
  }

  /**
   * Opens a password-protected PDF that failed as IMPORT_PASSWORD_PROTECTED and parses it now,
   * in this request. The password is used once and never stored or logged; a wrong one leaves
   * the import as it was, ready for another try.
   */
  async unlock(userId: string, id: string, password: string): Promise<ImportDto> {
    await this.find(userId, id);
    // Claims the import, so two unlocks at once don't both parse it.
    const { count } = await this.prisma.statementImport.updateMany({
      where: { id, userId, status: 'failed', error: 'IMPORT_PASSWORD_PROTECTED', fileBytes: { not: null } },
      data: { status: 'parsing', error: null },
    });
    if (count === 0) throw new AppError('IMPORT_NOT_LOCKED', 'This import is not waiting for a password', HttpStatus.CONFLICT);
    if ((await this.parse(id, password)) === 'IMPORT_WRONG_PASSWORD') {
      throw new AppError('IMPORT_WRONG_PASSWORD', "That password didn't open the statement", HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return this.get(userId, id);
  }

  /**
   * The background job (and unlock): read the file, stage its rows, drop the bytes, run the dry
   * run. Failures are stored as a code and returned; neither file content nor narrations are
   * logged. A PDF that needs a password keeps its (still encrypted) bytes so it can be unlocked.
   */
  async parse(importId: string, password?: string): Promise<string | null> {
    const imp = await this.prisma.statementImport.findUnique({ where: { id: importId }, include: { account: { select: accountSelect } } });
    if (!imp || imp.status !== 'parsing' || !imp.fileBytes) return null;
    try {
      const sheet = await readSheet(Buffer.from(imp.fileBytes), imp.format, password);
      const adapter = pickStatementAdapter(sheet, imp.fileName);
      if (!adapter) throw new SheetError('IMPORT_UNREADABLE');
      const parsed = adapter.parse(sheet);
      if (parsed.rows.length === 0) throw new ImportFailure('IMPORT_NO_ROWS');
      const accountId = imp.accountId ?? (await this.detectAccount(imp.userId, parsed))?.id ?? null;
      await this.stage(imp.id, parsed, accountId);
      const staged = await this.prisma.statementImport.findUniqueOrThrow({ where: { id: imp.id }, include: { account: { select: accountSelect } } });
      await this.runDryRun(imp.userId, staged);
      await this.prisma.statementImport.update({ where: { id: imp.id }, data: { status: 'review' } });
      return null;
    } catch (e) {
      const code = e instanceof SheetError || e instanceof ImportFailure ? e.code : 'IMPORT_FAILED';
      if (code === 'IMPORT_FAILED') this.logger.error(`Import ${imp.id} failed: ${e instanceof Error ? e.name : 'unknown'}`);
      const locked = code === 'IMPORT_PASSWORD_PROTECTED' || code === 'IMPORT_WRONG_PASSWORD';
      await this.prisma.importRow.deleteMany({ where: { importId: imp.id } });
      await this.prisma.statementImport.update({
        where: { id: imp.id },
        data: { status: 'failed', error: locked ? 'IMPORT_PASSWORD_PROTECTED' : code, ...(locked ? {} : { fileBytes: null }) },
      });
      return code;
    }
  }

  /** Writes the parsed rows and the statement's facts, and deletes the uploaded bytes. */
  private async stage(importId: string, parsed: ParsedStatement, accountId: string | null): Promise<void> {
    const breaks = new Set(balanceBreaks(parsed.rows));
    const seen = new Map<string, number>();
    const rows: Prisma.ImportRowCreateManyInput[] = parsed.rows.map((r) => {
      const key = statementRowKey(r);
      const nth = (seen.get(key) ?? 0) + 1;
      seen.set(key, nth);
      return {
        importId,
        rowNo: r.rowNo,
        occurredOn: new Date(`${r.date}T00:00:00Z`),
        amountPaise: BigInt(r.amountPaise),
        direction: r.direction,
        narration: r.narration,
        merchantName: r.counterparty ?? null,
        referenceNo: r.referenceNo ?? null,
        balancePaise: r.balancePaise === undefined ? null : BigInt(r.balancePaise),
        nth,
        flag: breaks.has(r.rowNo) ? 'balance_mismatch' : null,
      };
    });
    const days = parsed.rows.map((r) => r.date).sort();
    await this.prisma.$transaction([
      this.prisma.importRow.deleteMany({ where: { importId } }),
      this.prisma.importRow.createMany({ data: rows }),
      this.prisma.statementImport.update({
        where: { id: importId },
        data: {
          fileBytes: null,
          adapter: parsed.adapter,
          bankDetected: parsed.bank ?? null,
          last4Detected: parsed.accountLast4 ?? null,
          accountId,
          rowCount: rows.length,
          periodFrom: new Date(`${days[0]}T00:00:00Z`),
          periodTo: new Date(`${days[days.length - 1]}T00:00:00Z`),
        },
      }),
    ]);
  }

  /**
   * Checks every row against the ledger and stores the outcome: already imported or matched
   * (unticked), possible duplicate (unticked, flagged), or new (ticked). Choices the user made
   * in review (action, category) are kept.
   */
  private async runDryRun(userId: string, imp: ImportWithAccount): Promise<void> {
    const rows = await this.prisma.importRow.findMany({ where: { importId: imp.id }, orderBy: { rowNo: 'asc' } });
    if (rows.length === 0) return;
    const outcomes = await this.ingest.dryRun(
      userId,
      rows.map((r) => ({ txn: toNormalizedTxn(r, imp.accountId), source: toSourceInput(r) })),
    );
    const breaks = new Set(
      balanceBreaks(
        rows.map((r) => ({
          rowNo: r.rowNo,
          date: dayOf(r.occurredOn),
          amountPaise: Number(r.amountPaise),
          direction: r.direction,
          narration: r.narration,
          ...(r.balancePaise !== null ? { balancePaise: Number(r.balancePaise) } : {}),
        })),
      ),
    );
    let flaggedCount = 0;
    const values = rows.map((r, i) => {
      const o = outcomes[i]!;
      const flag = o.match?.action === 'flag' ? 'possible_duplicate' : breaks.has(r.rowNo) ? 'balance_mismatch' : null;
      if (flag) flaggedCount++;
      const action = o.match ? 'skip' : 'import';
      return Prisma.sql`(${r.rowNo}::int, ${o.match?.transactionId ?? null}::uuid, ${o.match?.rule ?? null}::text, ${flag}::"ImportRowFlag", ${action}::"ImportRowAction", ${o.category.categoryId}::uuid, ${o.category.source}::"CategorySource")`;
    });
    const newCount = outcomes.filter((o) => !o.match).length;
    const duplicateCount = outcomes.filter((o) => o.match?.action === 'merge').length;
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE import_rows AS r SET
          duplicate_of = v.dup,
          match_rule = v.rule,
          flag = v.flag,
          action = CASE WHEN r.edited THEN r.action ELSE v.action END,
          category_id = CASE WHEN r.category_source = 'user' THEN r.category_id ELSE v.cat END,
          category_source = CASE WHEN r.category_source = 'user' THEN r.category_source ELSE v.src END
        FROM (VALUES ${Prisma.join(values)}) AS v(row_no, dup, rule, flag, action, cat, src)
        WHERE r.import_id = ${imp.id}::uuid AND r.row_no = v.row_no`,
      this.prisma.statementImport.update({
        where: { id: imp.id },
        data: { newCount, duplicateCount, flaggedCount },
      }),
    ]);
  }

  /** Bank and last 4 from the file → the user's account. Never creates one: the user picks instead. */
  private async detectAccount(userId: string, parsed: ParsedStatement): Promise<AccountDto | null> {
    if (parsed.bank && parsed.accountLast4) {
      const found = await this.accounts.resolve(userId, { bank: parsed.bank, last4: parsed.accountLast4 }, { create: false });
      if (found) return found;
    }
    const all = await this.accounts.list(userId);
    const byLast4 = parsed.accountLast4 ? all.filter((a) => a.maskedNumber === parsed.accountLast4) : [];
    if (byLast4.length === 1) return byLast4[0]!;
    if (!parsed.accountLast4 && parsed.bank) {
      const byBank = all.filter((a) => a.bankName.toLowerCase() === parsed.bank!.toLowerCase());
      if (byBank.length === 1) return byBank[0]!;
    }
    return null;
  }

  /** Rows that need a category (new debits left on the default) and rows ticked to add, per import. */
  private async rowCounts(ids: string[]): Promise<Map<string, { needsCategory: number; selected: number }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ import_id: string; needs_category: bigint; selected: bigint }[]>`
      SELECT import_id,
        count(*) FILTER (WHERE duplicate_of IS NULL AND direction = 'debit' AND category_source = 'default' AND action = 'import') AS needs_category,
        count(*) FILTER (WHERE action = 'import') AS selected
      FROM import_rows WHERE import_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY import_id`;
    return new Map(rows.map((r) => [r.import_id, { needsCategory: Number(r.needs_category), selected: Number(r.selected) }]));
  }

  private async find(userId: string, id: string): Promise<ImportWithAccount> {
    const row = await this.prisma.statementImport.findFirst({ where: { id, userId }, include: { account: { select: accountSelect } } });
    if (!row) throw new AppError('NOT_FOUND', 'Import not found', HttpStatus.NOT_FOUND);
    return row;
  }

  private async findInReview(userId: string, id: string): Promise<ImportWithAccount> {
    const row = await this.find(userId, id);
    if (row.status !== 'review') throw notInReview();
    return row;
  }
}

class ImportFailure extends Error {
  constructor(readonly code: 'IMPORT_NO_ROWS') {
    super(code);
  }
}

function notInReview(): AppError {
  return new AppError('IMPORT_NOT_IN_REVIEW', 'This import is not waiting for review', HttpStatus.CONFLICT);
}

const accountSelect = { id: true, bankName: true, maskedNumber: true } as const;
const categorySelect = { id: true, name: true, icon: true, color: true } as const;

function rowFilter(filter: RowFilter): Prisma.ImportRowWhereInput {
  switch (filter) {
    case 'new':
      return { duplicateOf: null };
    case 'duplicates':
      return { duplicateOf: { not: null } };
    case 'flagged':
      return { flag: { not: null } };
    case 'needs_category':
      return { duplicateOf: null, direction: 'debit', categorySource: 'default', action: 'import' };
    case 'all':
      return {};
  }
}

/** Keeps the name readable in the list without trusting it: no paths, no control characters. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || 'statement';
}

function toImportDto(r: ImportWithAccount, counts?: { needsCategory: number; selected: number }): ImportDto {
  return {
    id: r.id,
    fileName: r.fileName,
    status: r.status,
    bankDetected: r.bankDetected,
    account: r.account,
    periodFrom: r.periodFrom ? dayOf(r.periodFrom) : null,
    periodTo: r.periodTo ? dayOf(r.periodTo) : null,
    rowCount: r.rowCount,
    newCount: r.newCount,
    duplicateCount: r.duplicateCount,
    flaggedCount: r.flaggedCount,
    needsCategoryCount: counts?.needsCategory ?? 0,
    selectedCount: counts?.selected ?? 0,
    importedCount: r.importedCount,
    mergedCount: r.mergedCount,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
  };
}

function toRowDto(r: RowWithCategory): ImportRowDto {
  const edits = editsOf(r);
  return {
    rowNo: r.rowNo,
    occurredOn: edits.occurredOn ?? dayOf(r.occurredOn),
    amountPaise: edits.amountPaise ?? Number(r.amountPaise),
    direction: r.direction,
    narration: r.narration,
    merchantName: edits.merchantName !== undefined ? edits.merchantName : r.merchantName,
    referenceNo: r.referenceNo,
    balancePaise: r.balancePaise === null ? null : Number(r.balancePaise),
    category: r.category,
    categorySource: r.categorySource,
    status: r.duplicateOf === null ? 'new' : r.flag === 'possible_duplicate' ? 'possible_duplicate' : 'duplicate',
    duplicateOf: r.duplicateOf,
    balanceMismatch: r.flag === 'balance_mismatch',
    action: r.action,
    edited: r.edited,
  };
}
