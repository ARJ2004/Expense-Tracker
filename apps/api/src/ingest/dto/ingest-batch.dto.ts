import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { AccountKind, CAPTURE_LIMITS, Direction, MAX_AMOUNT_PAISE } from '@et/domain';

export const MAX_BATCH_ITEMS = CAPTURE_LIMITS.maxBatchItems;
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

  @ApiProperty({ pattern: '^[0-9a-f]{64}$', description: 'smsMessageKey(): SHA-256 hex of sender, receive time and the parsed fields (never the body); makes resends no-ops' })
  @Matches(CAPTURE_LIMITS.messageKey)
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
  @Length(CAPTURE_LIMITS.bankLength.min, CAPTURE_LIMITS.bankLength.max)
  bank: string;

  @ApiPropertyOptional({ pattern: '^\\d{3,4}$', example: '1234', description: 'Last 4 (or 3) digits of the account or card' })
  @IsOptional()
  @Matches(CAPTURE_LIMITS.last4)
  last4?: string;

  @ApiPropertyOptional({ enum: Object.values(AccountKind), enumName: 'AccountKind' })
  @IsOptional()
  @IsIn(Object.values(AccountKind))
  accountKind?: AccountKind;

  @ApiPropertyOptional({ example: 'Swiggy' })
  @IsOptional()
  @IsString()
  @Length(CAPTURE_LIMITS.counterpartyLength.min, CAPTURE_LIMITS.counterpartyLength.max)
  counterparty?: string;

  @ApiPropertyOptional({ example: '427512345601' })
  @IsOptional()
  @Matches(CAPTURE_LIMITS.referenceNo)
  referenceNo?: string;

  @ApiPropertyOptional({ example: 'UPI', description: 'A short keyword for the type rules (UPI, CARD, ATM WITHDRAWAL, REFUND); never message text' })
  @IsOptional()
  @Matches(CAPTURE_LIMITS.narration)
  narration?: string;
}

export class IngestBatchDto {
  /**
   * Each row is validated on its own by CaptureService (a row that fails counts as rejected), so
   * one odd message never refuses the batch and stalls the phone's sync behind it.
   */
  @ApiProperty({ type: [CapturedTxnDto], minItems: 1, maxItems: MAX_BATCH_ITEMS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_ITEMS)
  @IsObject({ each: true })
  items: object[];
}

export class IngestBatchResultDto {
  @ApiProperty({ example: 3, description: 'New ledger rows' })
  created: number;

  @ApiProperty({ example: 1, description: 'Matched a transaction already in the ledger (a statement row, an entry) and added this source to it' })
  merged: number;

  @ApiProperty({ example: 0, description: 'Sent before; nothing changed' })
  skipped: number;

  @ApiProperty({ example: 0, description: 'Refused one by one (invalid, or dated more than a day ahead); the rest of the batch still went in' })
  rejected: number;
}
