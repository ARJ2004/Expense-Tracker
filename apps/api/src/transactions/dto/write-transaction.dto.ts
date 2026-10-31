import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';
import { Direction, MAX_AMOUNT_PAISE } from '@et/domain';

/** Empty or whitespace-only text clears the field. */
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid', description: 'Made by the app when the Add sheet opens; a retry with the same id returns the same transaction' })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE, example: 48600 })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  amountPaise: number;

  @ApiProperty({ enum: Object.values(Direction), enumName: 'Direction' })
  @IsIn(Object.values(Direction))
  direction: Direction;

  @ApiProperty({ format: 'date-time', description: 'No more than one day in the future' })
  @IsISO8601({ strict: true })
  occurredAt: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit to let the rules decide (Income for credits, Other for debits)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Swiggy' })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @Length(1, 80)
  merchantName?: string;

  @ApiPropertyOptional({ example: 'Team lunch' })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @Length(1, 200)
  note?: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  amountPaise?: number;

  @ApiPropertyOptional({ enum: Object.values(Direction), enumName: 'Direction' })
  @IsOptional()
  @IsIn(Object.values(Direction))
  direction?: Direction;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'null removes the account' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  accountId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'null or "" clears it' })
  @Transform(blankToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 80)
  merchantName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'null or "" clears it' })
  @Transform(blankToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 200)
  note?: string | null;
}
