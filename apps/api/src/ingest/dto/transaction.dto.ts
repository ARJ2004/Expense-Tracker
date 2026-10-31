import { ApiProperty } from '@nestjs/swagger';
import { CATEGORY_COLORS, CATEGORY_ICONS, CategorySource, Direction, SourceKind, TxnType } from '@et/domain';

export class TransactionAccountDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'HDFC Bank' })
  bankName: string;

  @ApiProperty({ type: String, nullable: true, example: '1234' })
  maskedNumber: string | null;
}

export class TransactionCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Food & Dining' })
  name: string;

  @ApiProperty({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' })
  icon: string;

  @ApiProperty({ enum: CATEGORY_COLORS, enumName: 'CategoryColor' })
  color: string;
}

export class TransactionSourceDto {
  @ApiProperty({ enum: Object.values(SourceKind), enumName: 'SourceKind' })
  source: SourceKind;

  @ApiProperty({ format: 'date-time' })
  receivedAt: string;
}

/** A ledger row as lists show it. */
export class TransactionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 48600, description: 'Always positive; direction gives the sign' })
  amountPaise: number;

  @ApiProperty({ enum: Object.values(Direction), enumName: 'Direction' })
  direction: Direction;

  @ApiProperty({ enum: Object.values(TxnType), enumName: 'TxnType' })
  type: TxnType;

  @ApiProperty({ format: 'date-time' })
  occurredAt: string;

  @ApiProperty({ type: String, nullable: true, example: 'Swiggy' })
  merchantName: string | null;

  @ApiProperty({ type: TransactionCategoryDto })
  category: TransactionCategoryDto;

  @ApiProperty({ type: TransactionAccountDto, nullable: true })
  account: TransactionAccountDto | null;
}

/** One transaction with everything the Detail screen shows, including every source behind it. */
export class TransactionDetailDto extends TransactionSummaryDto {
  @ApiProperty({ type: String, nullable: true, example: 'Team lunch' })
  note: string | null;

  @ApiProperty({ enum: Object.values(CategorySource), enumName: 'CategorySource' })
  categorySource: CategorySource;

  @ApiProperty({ description: 'The user changed amount, date or merchant; later sources never overwrite it' })
  userEdited: boolean;

  @ApiProperty({ type: [TransactionSourceDto] })
  sources: TransactionSourceDto[];
}

export class TransactionSummaryListDto {
  @ApiProperty({ type: [TransactionSummaryDto] })
  items: TransactionSummaryDto[];
}

export class RecentCategoriesDto {
  @ApiProperty({ type: [String], description: 'Category ids the user picked most recently, newest first' })
  ids: string[];
}

export class DayTotalDto {
  @ApiProperty({ format: 'date', example: '2026-10-31', description: 'IST calendar day' })
  date: string;

  @ApiProperty({ type: 'integer', example: 72400 })
  debitPaise: number;

  @ApiProperty({ type: 'integer', example: 0 })
  creditPaise: number;

  @ApiProperty({ type: 'integer', example: -72400, description: 'creditPaise − debitPaise' })
  netPaise: number;
}

export class TransactionPageDto {
  @ApiProperty({ type: [TransactionSummaryDto] })
  items: TransactionSummaryDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Pass as cursor for the next page; null on the last page' })
  nextCursor: string | null;

  @ApiProperty({ type: [DayTotalDto], description: 'Totals for every IST day on this page, over all rows matching the filters' })
  dayTotals: DayTotalDto[];
}

export class RecategorizeResultDto {
  @ApiProperty({ type: TransactionDetailDto })
  transaction: TransactionDetailDto;

  @ApiProperty({ type: 'integer', description: 'Other transactions from the same merchant that moved too' })
  updatedCount: number;
}
