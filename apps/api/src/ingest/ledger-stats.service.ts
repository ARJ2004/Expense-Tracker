import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { istMonthRange } from '@et/domain';
import { PrismaService } from '../common';

/**
 * The design doc's definitions, shown in the app so the numbers are trusted:
 *  - Spend  = debits of type expense or atm_withdrawal, minus refunds (refunds reduce spend in
 *             their own category). Transfers between own accounts are not spend.
 *  - Income = credits of type income.
 * Every figure sums `transactions` (never `transaction_sources`), so a merged payment counts once.
 */
const SPEND_DEBIT = Prisma.sql`(t.direction = 'debit' AND t.type IN ('expense', 'atm_withdrawal'))`;
const REFUND = Prisma.sql`(t.direction = 'credit' AND t.type = 'refund')`;
const INCOME = Prisma.sql`(t.direction = 'credit' AND t.type = 'income')`;
/** A debit adds to spend; a refund takes it back. */
const SIGNED_SPEND = Prisma.sql`CASE WHEN ${SPEND_DEBIT} THEN t.amount_paise WHEN ${REFUND} THEN -t.amount_paise ELSE 0 END`;

export const TREND_BUCKETS = ['day', 'week', 'month'] as const;
export type TrendBucket = (typeof TREND_BUCKETS)[number];

export interface MonthTotals {
  spendPaise: number;
  refundPaise: number;
  incomePaise: number;
  transactionCount: number;
}

export interface CategorySpend {
  category: { id: string; name: string; icon: string; color: string };
  spendPaise: number;
  count: number;
}

export interface MerchantSpend {
  merchantName: string;
  spendPaise: number;
  count: number;
}

export interface TrendPoint {
  /** First IST day of the bucket, "YYYY-MM-DD". */
  start: string;
  spendPaise: number;
  incomePaise: number;
}

/**
 * Aggregates over the ledger for read-only reporting (dashboard now, budgets later). Owned by
 * ingest because ingest owns `transactions`; other modules never query the table themselves.
 */
@Injectable()
export class LedgerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async monthTotals(userId: string, month: string): Promise<MonthTotals> {
    const { start, end } = istMonthRange(month);
    const [row] = await this.prisma.$queryRaw<{ debit: bigint; refund: bigint; income: bigint; n: bigint }[]>`
      SELECT
        COALESCE(SUM(t.amount_paise) FILTER (WHERE ${SPEND_DEBIT}), 0) AS debit,
        COALESCE(SUM(t.amount_paise) FILTER (WHERE ${REFUND}), 0) AS refund,
        COALESCE(SUM(t.amount_paise) FILTER (WHERE ${INCOME}), 0) AS income,
        count(*) AS n
      FROM transactions t
      WHERE ${live(userId, start, end)}`;
    const debit = Number(row!.debit);
    const refund = Number(row!.refund);
    return { spendPaise: Math.max(0, debit - refund), refundPaise: refund, incomePaise: Number(row!.income), transactionCount: Number(row!.n) };
  }

  /** Spend per category, largest first; categories netting to zero or less are left out. */
  async spendByCategory(userId: string, month: string): Promise<CategorySpend[]> {
    const { start, end } = istMonthRange(month);
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; icon: string; color: string; spend: bigint; n: bigint }[]>`
      SELECT c.id, c.name, c.icon, c.color, SUM(${SIGNED_SPEND}) AS spend, count(*) FILTER (WHERE ${SPEND_DEBIT}) AS n
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE ${live(userId, start, end)} AND (${SPEND_DEBIT} OR ${REFUND})
      GROUP BY c.id, c.name, c.icon, c.color, c.sort_order
      HAVING SUM(${SIGNED_SPEND}) > 0
      ORDER BY spend DESC, c.sort_order ASC`;
    return rows.map((r) => ({ category: { id: r.id, name: r.name, icon: r.icon, color: r.color }, spendPaise: Number(r.spend), count: Number(r.n) }));
  }

  /** Where the most went, by merchant (grouped by merchant key, shown by its latest name). */
  async topMerchants(userId: string, month: string, limit = 5): Promise<MerchantSpend[]> {
    const { start, end } = istMonthRange(month);
    const rows = await this.prisma.$queryRaw<{ name: string; spend: bigint; n: bigint }[]>`
      SELECT (array_agg(t.merchant_name ORDER BY t.occurred_at DESC))[1] AS name, SUM(${SIGNED_SPEND}) AS spend,
        count(*) FILTER (WHERE ${SPEND_DEBIT}) AS n
      FROM transactions t
      WHERE ${live(userId, start, end)} AND t.merchant_key IS NOT NULL AND (${SPEND_DEBIT} OR ${REFUND})
      GROUP BY t.merchant_key
      HAVING SUM(${SIGNED_SPEND}) > 0
      ORDER BY spend DESC, name ASC
      LIMIT ${limit}`;
    return rows.map((r) => ({ merchantName: r.name, spendPaise: Number(r.spend), count: Number(r.n) }));
  }

  /**
   * Spend and income per bucket between two IST days (inclusive), every bucket present, empty
   * ones as zero. Weeks start on Monday.
   */
  async trend(userId: string, from: string, to: string, bucket: TrendBucket): Promise<TrendPoint[]> {
    // The bucket is spliced into SQL as a keyword; only the three known values ever get there.
    if (!TREND_BUCKETS.includes(bucket)) throw new Error(`Unknown bucket ${String(bucket)}`);
    const unit = Prisma.raw(`'${bucket}'`);
    const step = Prisma.raw(`'1 ${bucket}'`);
    const rows = await this.prisma.$queryRaw<{ start: Date; spend: bigint; income: bigint }[]>`
      WITH buckets AS (
        SELECT generate_series(date_trunc(${unit}, ${from}::date::timestamp), ${to}::date::timestamp, ${step}::interval) AS start
      )
      SELECT b.start,
        COALESCE(SUM(${SIGNED_SPEND}), 0) AS spend,
        COALESCE(SUM(t.amount_paise) FILTER (WHERE ${INCOME}), 0) AS income
      FROM buckets b
      LEFT JOIN transactions t
        ON t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND date_trunc(${unit}, t.occurred_at AT TIME ZONE 'Asia/Kolkata') = b.start
        AND (t.occurred_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY b.start
      ORDER BY b.start`;
    return rows.map((r) => ({ start: r.start.toISOString().slice(0, 10), spendPaise: Math.max(0, Number(r.spend)), incomePaise: Number(r.income) }));
  }

  async hasAnyTransactions(userId: string): Promise<boolean> {
    return (await this.prisma.transaction.count({ where: { userId, deletedAt: null }, take: 1 })) > 0;
  }
}

function live(userId: string, start: Date, end: Date): Prisma.Sql {
  return Prisma.sql`t.user_id = ${userId}::uuid AND t.deleted_at IS NULL AND t.occurred_at >= ${start} AND t.occurred_at < ${end}`;
}
