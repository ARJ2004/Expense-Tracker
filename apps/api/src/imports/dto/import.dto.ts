import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CategorySource, Direction, MAX_AMOUNT_PAISE } from '@et/domain';
import { TransactionAccountDto, TransactionCategoryDto } from '../../ingest';

export const IMPORT_STATUSES = ['parsing', 'review', 'imported', 'failed'] as const;
export const ROW_FILTERS = ['all', 'new', 'duplicates', 'flagged', 'needs_category'] as const;
export type RowFilter = (typeof ROW_FILTERS)[number];

/** An import as the Imports list and the Review header show it. */
export class ImportDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Acct_Statement_Oct2026.xlsx' })
  fileName: string;

  @ApiProperty({ enum: IMPORT_STATUSES, enumName: 'ImportStatus' })
  status: (typeof IMPORT_STATUSES)[number];

  @ApiProperty({ type: String, nullable: true, example: 'HDFC Bank', description: 'Bank named in the file, if any' })
  bankDetected: string | null;

  @ApiProperty({ type: TransactionAccountDto, nullable: true, description: 'Null until detected or picked' })
  account: TransactionAccountDto | null;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2026-10-01' })
  periodFrom: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2026-10-31' })
  periodTo: string | null;

  @ApiProperty({ example: 160 })
  rowCount: number;

  @ApiProperty({ example: 142, description: 'Rows not in the ledger yet' })
  newCount: number;

  @ApiProperty({ example: 18, description: 'Rows already in the ledger (merged on confirm, never added twice)' })
  duplicateCount: number;

  @ApiProperty({ example: 2, description: 'Possible duplicates and balance mismatches to look at' })
  flaggedCount: number;

  @ApiProperty({ example: 6, description: 'New debit rows no rule could categorize' })
  needsCategoryCount: number;

  @ApiProperty({ example: 0, description: 'Rows that will be added: ticked and new' })
  selectedCount: number;

  @ApiProperty({ example: 0 })
  importedCount: number;

  @ApiProperty({ example: 0 })
  mergedCount: number;

  @ApiProperty({ type: String, nullable: true, example: 'IMPORT_NO_ROWS', description: 'Why parsing failed' })
  error: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  confirmedAt: string | null;
}

export class ImportListDto {
  @ApiProperty({ type: [ImportDto] })
  items: ImportDto[];
}

export class UploadResultDto {
  @ApiProperty({ type: ImportDto })
  import: ImportDto;

  @ApiPropertyOptional({ format: 'date-time', description: 'Set when this exact file was imported before' })
  alreadyImportedAt?: string;
}

export class ImportRowDto {
  @ApiProperty({ example: 12 })
  rowNo: number;

  @ApiProperty({ format: 'date', example: '2026-10-31' })
  occurredOn: string;

  @ApiProperty({ example: 48600 })
  amountPaise: number;

  @ApiProperty({ enum: Object.values(Direction), enumName: 'Direction' })
  direction: Direction;

  @ApiProperty({ example: 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-...' })
  narration: string;

  @ApiProperty({ type: String, nullable: true, example: 'Swiggy Limited' })
  merchantName: string | null;

  @ApiProperty({ type: String, nullable: true })
  referenceNo: string | null;

  @ApiProperty({ type: Number, nullable: true })
  balancePaise: number | null;

  @ApiProperty({ type: TransactionCategoryDto, nullable: true })
  category: TransactionCategoryDto | null;

  @ApiProperty({ enum: Object.values(CategorySource), enumName: 'CategorySource' })
  categorySource: CategorySource;

  @ApiProperty({ enum: ['new', 'duplicate', 'possible_duplicate'], enumName: 'ImportRowStatus' })
  status: 'new' | 'duplicate' | 'possible_duplicate';

  @ApiProperty({ type: String, nullable: true, format: 'uuid', description: 'The ledger transaction it matches' })
  duplicateOf: string | null;

  @ApiProperty({ type: Boolean, description: "The running balance doesn't add up at this row" })
  balanceMismatch: boolean;

  @ApiProperty({ enum: ['import', 'skip'], enumName: 'ImportRowAction' })
  action: 'import' | 'skip';

  @ApiProperty()
  edited: boolean;
}

export class ImportRowListDto {
  @ApiProperty({ type: [ImportRowDto] })
  items: ImportRowDto[];
}

export class UploadImportDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'The account this statement is for, if the user already knows' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class RowsQueryDto {
  @ApiPropertyOptional({ enum: ROW_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(ROW_FILTERS)
  filter?: RowFilter;
}

export class UpdateImportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId: string;
}

export class UpdateImportRowDto {
  @ApiPropertyOptional({ enum: ['import', 'skip'] })
  @IsOptional()
  @IsIn(['import', 'skip'])
  action?: 'import' | 'skip';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 48600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  amountPaise?: number;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'occurredOn must be YYYY-MM-DD' })
  occurredOn?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Swiggy' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  merchantName?: string | null;
}
