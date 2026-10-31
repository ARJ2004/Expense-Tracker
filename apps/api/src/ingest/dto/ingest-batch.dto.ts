import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AccountKind, Direction, MAX_AMOUNT_PAISE } from '@et/domain';

export const MAX_BATCH_ITEMS = 100;
/** Device-captured sources this endpoint takes. Notifications join in v0.3. */
export const DEVICE_SOURCES = ['sms'] as const;
export type DeviceSource = (typeof DEVICE_SOURCES)[number];

/**
 * One transaction the phone read from a bank SMS and parsed with @et/parsers. Only parsed fields
 * travel: there is deliberately no field for the message body.
 */
export class CapturedTxnDto {
  @ApiProperty({ enum: DEVICE_SOURCES, enumName: 'DeviceSource' })
  @IsIn(DEVICE_SOURCES)
  source: DeviceSource;

  @ApiProperty({ pattern: '^[0-9a-f]{64}$', description: 'smsMessageKey(): SHA-256 hex of sender, receive time and body; makes resends no-ops' })
  @Matches(/^[0-9a-f]{64}$/)
  messageKey: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: MAX_AMOUNT_PAISE, example: 48600 })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  amountPaise: number;

  @ApiProperty({ enum: Object.values(Direction), enumName: 'Direction' })
  @IsIn(Object.values(Direction))
  direction: Direction;

  @ApiProperty({ format: 'date-time', description: 'A row more than a day in the future is counted as rejected' })
  @IsISO8601({ strict: true })
  occurredAt: string;

  @ApiProperty({ enum: ['minute', 'day'], description: '"day" when the SMS named an earlier day than it arrived on' })
  @IsIn(['minute', 'day'])
  timePrecision: 'minute' | 'day';

  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  @Length(1, 60)
  bank: string;

  @ApiPropertyOptional({ pattern: '^\\d{3,4}$', example: '1234', description: 'Last 4 (or 3) digits of the account or card' })
  @IsOptional()
  @Matches(/^\d{3,4}$/)
  last4?: string;

  @ApiPropertyOptional({ enum: Object.values(AccountKind), enumName: 'AccountKind' })
  @IsOptional()
  @IsIn(Object.values(AccountKind))
  accountKind?: AccountKind;

  @ApiPropertyOptional({ example: 'Swiggy' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  counterparty?: string;

  @ApiPropertyOptional({ example: '427512345601' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{6,22}$/)
  referenceNo?: string;

  @ApiPropertyOptional({ example: 'UPI', description: 'A short keyword for the type rules (UPI, CARD, ATM WITHDRAWAL, REFUND); never message text' })
  @IsOptional()
  @Matches(/^[A-Z ]{1,24}$/)
  narration?: string;
}

export class IngestBatchDto {
  @ApiProperty({ type: [CapturedTxnDto], minItems: 1, maxItems: MAX_BATCH_ITEMS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CapturedTxnDto)
  items: CapturedTxnDto[];
}

export class IngestBatchResultDto {
  @ApiProperty({ example: 3, description: 'New ledger rows' })
  created: number;

  @ApiProperty({ example: 1, description: 'Matched a transaction already in the ledger (a statement row, an entry) and added this source to it' })
  merged: number;

  @ApiProperty({ example: 0, description: 'Sent before; nothing changed' })
  skipped: number;

  @ApiProperty({ example: 0, description: 'Refused one by one (dated more than a day ahead); the rest of the batch still went in' })
  rejected: number;
}
