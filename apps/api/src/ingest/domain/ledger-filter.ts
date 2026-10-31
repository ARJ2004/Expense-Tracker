import type { Prisma } from '@prisma/client';
import { istDayRange, type LedgerFilters } from '@et/domain';

/** Where the next page starts: the last row of this one, newest-first order (occurred_at, id). */
export interface LedgerCursor {
  occurredAt: Date;
  id: string;
}

/**
 * One Prisma where clause for the list and its day totals, so both always agree. Every query
 * is scoped to the user and skips soft-deleted rows.
 */
export function ledgerWhere(userId: string, f: LedgerFilters): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [];
  if (f.from || f.to) {
    and.push({
      occurredAt: {
        ...(f.from && { gte: istDayRange(f.from).start }),
        ...(f.to && { lt: istDayRange(f.to).end }),
      },
    });
  }
  if (f.minAmountPaise !== undefined || f.maxAmountPaise !== undefined) {
    and.push({
      amountPaise: {
        ...(f.minAmountPaise !== undefined && { gte: BigInt(f.minAmountPaise) }),
        ...(f.maxAmountPaise !== undefined && { lte: BigInt(f.maxAmountPaise) }),
      },
    });
  }
  if (f.q) {
    const q = escapeLike(f.q);
    and.push({ OR: [{ merchantName: { contains: q, mode: 'insensitive' } }, { note: { contains: q, mode: 'insensitive' } }] });
  }
  return {
    userId,
    deletedAt: null,
    ...(f.direction && { direction: f.direction }),
    ...(f.type && { type: f.type }),
    ...(f.accountId && { accountId: f.accountId }),
    ...(f.categoryIds?.length && { categoryId: { in: f.categoryIds } }),
    ...(f.source && { sources: { some: { source: f.source } } }),
    ...(and.length > 0 && { AND: and }),
  };
}

/** Prisma passes `contains` to ILIKE as is, so % and _ would be wildcards; search treats them literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/** Rows strictly older than the cursor in (occurred_at desc, id desc) order. */
export function afterCursor(c: LedgerCursor): Prisma.TransactionWhereInput {
  return { OR: [{ occurredAt: { lt: c.occurredAt } }, { occurredAt: c.occurredAt, id: { lt: c.id } }] };
}

/** Opaque to the app: base64url of "<epoch ms>.<id>". */
export function encodeCursor(c: LedgerCursor): string {
  return Buffer.from(`${c.occurredAt.getTime()}.${c.id}`).toString('base64url');
}

export function decodeCursor(raw: string): LedgerCursor | null {
  const text = Buffer.from(raw, 'base64url').toString('utf8');
  const match = /^(\d{1,15})\.([0-9a-f-]{36})$/.exec(text);
  if (!match) return null;
  return { occurredAt: new Date(Number(match[1])), id: match[2]! };
}
