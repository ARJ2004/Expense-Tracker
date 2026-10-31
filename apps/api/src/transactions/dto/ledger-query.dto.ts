import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, Validate, ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { Direction, isDayKey, MAX_AMOUNT_PAISE, SourceKind, TxnType } from '@et/domain';

/** A real calendar day as "YYYY-MM-DD". */
@ValidatorConstraint({ name: 'isDayKey' })
class IsDayKey implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isDayKey(value);
  }

  defaultMessage(): string {
    return '$property must be a date as YYYY-MM-DD';
  }
}

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);
/** ?categoryId=a&categoryId=b arrives as an array, a single one as a string. */
const toArray = ({ value }: { value: unknown }) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

export class LedgerQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'First IST day included', example: '2026-10-01' })
  @IsOptional()
  @Validate(IsDayKey)
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Last IST day included', example: '2026-10-31' })
  @IsOptional()
  @Validate(IsDayKey)
  to?: string;

  @ApiPropertyOptional({ enum: Object.values(Direction), enumName: 'Direction' })
  @IsOptional()
  @IsIn(Object.values(Direction))
  direction?: Direction;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Repeat for several categories' })
  @IsOptional()
  @Transform(toArray)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  categoryId?: string[];

  @ApiPropertyOptional({ enum: Object.values(TxnType), enumName: 'TxnType' })
  @IsOptional()
  @IsIn(Object.values(TxnType))
  type?: TxnType;

  @ApiPropertyOptional({ enum: Object.values(SourceKind), enumName: 'SourceKind' })
  @IsOptional()
  @IsIn(Object.values(SourceKind))
  source?: SourceKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  minAmountPaise?: number;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  maxAmountPaise?: number;

  @ApiPropertyOptional({ description: 'Merchant or note contains this, any case', minLength: 1, maxLength: 60 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, 60)
  q?: string;

  @ApiPropertyOptional({ description: 'nextCursor from the previous page' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  cursor?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RecategorizeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ default: false, description: 'Also move other rows from this merchant and remember it for new ones' })
  @IsOptional()
  @IsBoolean()
  applyToMerchant?: boolean;
}
