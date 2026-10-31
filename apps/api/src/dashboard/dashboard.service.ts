import { HttpStatus, Injectable } from '@nestjs/common';
import { istMonthKey } from '@et/domain';
import { AppError } from '../common';
import { LedgerStatsService, type TrendBucket } from '../ingest';
import { UsersService } from '../users';
import { bucketCount, budgetFigures, MAX_TREND_BUCKETS } from './domain/summary-math';
import type { DashboardSummaryDto, DashboardTrendDto } from './dto/dashboard.dto';

/** Read-only: Home's numbers, computed by SQL on request (no caches; one user has a few thousand rows a year). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly stats: LedgerStatsService,
    private readonly users: UsersService,
  ) {}

  async summary(userId: string, month: string = istMonthKey(new Date())): Promise<DashboardSummaryDto> {
    const [totals, byCategory, topMerchants, me, hasAny] = await Promise.all([
      this.stats.monthTotals(userId, month),
      this.stats.spendByCategory(userId, month),
      this.stats.topMerchants(userId, month),
      this.users.getMe(userId),
      this.stats.hasAnyTransactions(userId),
    ]);
    return {
      month,
      spendPaise: totals.spendPaise,
      incomePaise: totals.incomePaise,
      refundPaise: totals.refundPaise,
      netPaise: totals.incomePaise - totals.spendPaise,
      monthlyIncomePaise: me.monthlyIncomePaise,
      ...budgetFigures(totals.spendPaise, me.monthlyIncomePaise),
      byCategory,
      topMerchants,
      transactionCount: totals.transactionCount,
      hasAnyTransactions: hasAny,
    };
  }

  async trend(userId: string, from: string, to: string, bucket: TrendBucket): Promise<DashboardTrendDto> {
    if (from > to) throw new AppError('VALIDATION_FAILED', 'from must not be after to', HttpStatus.BAD_REQUEST);
    if (bucketCount(from, to, bucket) > MAX_TREND_BUCKETS[bucket]) {
      throw new AppError('RANGE_TOO_LONG', `At most ${MAX_TREND_BUCKETS[bucket]} ${bucket} buckets per request`, HttpStatus.BAD_REQUEST);
    }
    return { bucket, points: await this.stats.trend(userId, from, to, bucket) };
  }
}
