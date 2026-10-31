import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Validate } from 'class-validator';
import { IsDayKey, IsMonthKey } from '../../common';
import { TransactionCategoryDto, TREND_BUCKETS, type TrendBucket } from '../../ingest';

export class SummaryQueryDto {
  @ApiPropertyOptional({ example: '2026-10', description: 'IST calendar month; defaults to the current one' })
  @IsOptional()
  @Validate(IsMonthKey)
  month?: string;
}

export class TrendQueryDto {
  @ApiProperty({ format: 'date', example: '2026-10-01', description: 'First IST day included' })
  @Validate(IsDayKey)
  from: string;

  @ApiProperty({ format: 'date', example: '2026-10-31', description: 'Last IST day included' })
  @Validate(IsDayKey)
  to: string;

  @ApiProperty({ enum: TREND_BUCKETS, enumName: 'TrendBucket' })
  @IsIn(TREND_BUCKETS)
  bucket: TrendBucket;
}

export class CategorySpendDto {
  @ApiProperty({ type: TransactionCategoryDto })
  category: TransactionCategoryDto;

  @ApiProperty({ example: 984000, description: 'Spend in paise, refunds already taken off' })
  spendPaise: number;

  @ApiProperty({ example: 23, description: 'Debits counted' })
  count: number;
}

export class MerchantSpendDto {
  @ApiProperty({ example: 'Swiggy' })
  merchantName: string;

  @ApiProperty({ example: 486000 })
  spendPaise: number;

  @ApiProperty({ example: 10 })
  count: number;
}

/**
 * One month on Home. Spend = debits of type expense or ATM withdrawal minus refunds; income =
 * credits of type income; transfers between own accounts count as neither.
 */
export class DashboardSummaryDto {
  @ApiProperty({ example: '2026-10' })
  month: string;

  @ApiProperty({ example: 4218000 })
  spendPaise: number;

  @ApiProperty({ example: 7500000 })
  incomePaise: number;

  @ApiProperty({ example: 119900, description: 'Refunds in the month (already taken off spend)' })
  refundPaise: number;

  @ApiProperty({ example: 3282000, description: 'incomePaise − spendPaise; may be negative' })
  netPaise: number;

  @ApiProperty({ type: Number, nullable: true, example: 7500000, description: 'Monthly income from the profile' })
  monthlyIncomePaise: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 3282000, description: 'Monthly income − spend; negative when over; null without an income' })
  leftToSpendPaise: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 56, description: 'Spend as a whole percent of monthly income' })
  usedPercent: number | null;

  @ApiProperty({ type: [CategorySpendDto], description: 'Every category with spend, largest first' })
  byCategory: CategorySpendDto[];

  @ApiProperty({ type: [MerchantSpendDto], description: 'Top 5 merchants by spend' })
  topMerchants: MerchantSpendDto[];

  @ApiProperty({ example: 212, description: 'Transactions in the month' })
  transactionCount: number;

  @ApiProperty({ description: 'False until the user has any transaction at all (Home empty state)' })
  hasAnyTransactions: boolean;
}

export class TrendPointDto {
  @ApiProperty({ format: 'date', example: '2026-10-01', description: 'First IST day of the bucket' })
  start: string;

  @ApiProperty({ example: 48600 })
  spendPaise: number;

  @ApiProperty({ example: 0 })
  incomePaise: number;
}

export class DashboardTrendDto {
  @ApiProperty({ enum: TREND_BUCKETS, enumName: 'TrendBucket' })
  bucket: TrendBucket;

  @ApiProperty({ type: [TrendPointDto] })
  points: TrendPointDto[];
}
