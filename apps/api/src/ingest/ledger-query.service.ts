import { HttpStatus, Injectable } from '@nestjs/common';
import type { Account, Category, Prisma, Transaction, TransactionSource } from '@prisma/client';
import { istDayRange, istDateKey, OTHER_CATEGORY_ID, SYSTEM_CATEGORIES, type LedgerFilters } from '@et/domain';
import { AppError, PrismaService } from '../common';
import { sumByIstDay } from './domain/day-totals';
import { afterCursor, decodeCursor, encodeCursor, ledgerWhere } from './domain/ledger-filter';
import type {
  TransactionAccountDto,
  TransactionCategoryDto,
  TransactionDetailDto,
  TransactionPageDto,
  TransactionSummaryDto,
} from './dto/transaction.dto';

const OTHER = SYSTEM_CATEGORIES.find((c) => c.id === OTHER_CATEGORY_ID)!;
const summaryInclude = { account: true, category: true } satisfies Prisma.TransactionInclude;

type SummaryRow = Transaction & { account: Account | null; category: Category | null };

/** Read side of the ledger. Every query filters by user and skips soft-deleted rows. */
@Injectable()
export class LedgerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, id: string): Promise<TransactionDetailDto> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: { ...summaryInclude, sources: { orderBy: { receivedAt: 'asc' } } },
    });
    if (!row) throw new AppError('NOT_FOUND', 'Transaction not found', HttpStatus.NOT_FOUND);
    return toDetail(row);
  }

  /**
   * One page of the ledger, newest first, keyset-paged on (occurred_at, id) so rows arriving
   * while the user scrolls never shift the pages. dayTotals cover each IST day on the page in
   * full (same filters), including the part of a day that falls on the next page.
   */
  async list(userId: string, filters: LedgerFilters, cursor: string | undefined, limit: number): Promise<TransactionPageDto> {
    const after = cursor ? decodeCursor(cursor) : null;
    if (cursor && !after) throw new AppError('INVALID_CURSOR', 'Cursor is not valid; start again without it', HttpStatus.BAD_REQUEST);
    const where = ledgerWhere(userId, filters);

    const rows = await this.prisma.transaction.findMany({
      where: after ? { AND: [where, afterCursor(after)] } : where,
      include: summaryInclude,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last ? encodeCursor({ occurredAt: last.occurredAt, id: last.id }) : null;

    let dayTotals: TransactionPageDto['dayTotals'] = [];
    if (last) {
      const newestDay = istDateKey(page[0]!.occurredAt);
      const oldestDay = istDateKey(last.occurredAt);
      const amounts = await this.prisma.transaction.findMany({
        where: { AND: [where, { occurredAt: { gte: istDayRange(oldestDay).start, lt: istDayRange(newestDay).end } }] },
        select: { occurredAt: true, direction: true, amountPaise: true },
      });
      dayTotals = sumByIstDay(amounts);
    }
    return { items: page.map(toSummary), nextCursor, dayTotals };
  }

  async recent(userId: string, limit: number): Promise<TransactionSummaryDto[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      include: summaryInclude,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toSummary);
  }

  /** Categories the user picked themselves, most recently used first (for the Add sheet chips). */
  async recentCategoryIds(userId: string, limit = 8): Promise<string[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, deletedAt: null, categorySource: 'user', categoryId: { not: null } },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: limit,
    });
    return groups.map((g) => g.categoryId).filter((id): id is string => id !== null);
  }
}

function toAccount(a: Account | null): TransactionAccountDto | null {
  return a ? { id: a.id, bankName: a.bankName, maskedNumber: a.maskedNumber } : null;
}

/** A row whose custom category was just deleted is shown under Other until the listener moves it. */
function toCategory(c: Category | null): TransactionCategoryDto {
  return c ? { id: c.id, name: c.name, icon: c.icon, color: c.color } : { id: OTHER.id, name: OTHER.name, icon: OTHER.icon, color: OTHER.color };
}

export function toSummary(row: SummaryRow): TransactionSummaryDto {
  return {
    id: row.id,
    amountPaise: Number(row.amountPaise),
    direction: row.direction,
    type: row.type,
    occurredAt: row.occurredAt.toISOString(),
    merchantName: row.merchantName,
    category: toCategory(row.category),
    account: toAccount(row.account),
  };
}

function toDetail(row: SummaryRow & { sources: TransactionSource[] }): TransactionDetailDto {
  return {
    ...toSummary(row),
    note: row.note,
    categorySource: row.categorySource,
    userEdited: row.userEdited,
    sources: row.sources.map((s) => ({ source: s.source, receivedAt: s.receivedAt.toISOString() })),
  };
}
