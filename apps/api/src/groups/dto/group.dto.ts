import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { GROUP_LIMITS, GROUP_SPLIT_MODES, type GroupSplitMode } from '@et/domain';
import { IsDayKey } from '../../common';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const trimEach = ({ value }: { value: unknown }) => (Array.isArray(value) ? value.map((v) => trim({ value: v })) : value);
const { nameLength, memberNameLength, descriptionLength, maxMembers, maxAmountPaise } = GROUP_LIMITS;

// ---- Requests ----

export class CreateGroupDto {
  @ApiProperty({ example: 'Goa trip' })
  @Transform(trim)
  @IsString()
  @Length(nameLength.min, nameLength.max)
  name: string;

  @ApiPropertyOptional({ example: '🏖️' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  emoji?: string;

  /** Other members' names; the owner is added as "You". */
  @ApiPropertyOptional({ type: [String], example: ['Ravi', 'Priya', 'Arjun'] })
  @IsOptional()
  @Transform(trimEach)
  @ArrayMaxSize(maxMembers - 1)
  @IsString({ each: true })
  @Length(memberNameLength.min, memberNameLength.max, { each: true })
  members?: string[];
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Goa trip' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(nameLength.min, nameLength.max)
  name?: string;

  @ApiPropertyOptional({ example: '🏖️' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  emoji?: string;

  @ApiPropertyOptional({ description: 'Archive to hide it from the list, or bring it back' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class GroupListQueryDto {
  @ApiPropertyOptional({ description: 'Archived groups instead of active ones' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  archived?: boolean;
}

export class MemberNameDto {
  @ApiProperty({ example: 'Ravi' })
  @Transform(trim)
  @IsString()
  @Length(memberNameLength.min, memberNameLength.max)
  name: string;
}

export class ShareInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId: string;

  @ApiProperty({ example: 60_000, description: 'Integer paise' })
  @IsInt()
  @Min(0)
  @Max(maxAmountPaise)
  sharePaise: number;
}

/** Creates or replaces an expense. Equal splits take memberIds; exact splits take shares. */
export class SaveExpenseDto {
  @ApiProperty({ example: "Dinner at Fisherman's Wharf" })
  @Transform(trim)
  @IsString()
  @Length(descriptionLength.min, descriptionLength.max)
  description: string;

  @ApiProperty({ example: 360_000, description: 'Integer paise' })
  @IsInt()
  @Min(1)
  @Max(maxAmountPaise)
  amountPaise: number;

  @ApiProperty({ example: '2026-11-20', description: 'IST day, not in the future' })
  @Validate(IsDayKey)
  day: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paidById: string;

  @ApiProperty({ enum: GROUP_SPLIT_MODES, enumName: 'GroupSplitMode' })
  @IsIn(GROUP_SPLIT_MODES)
  splitMode: GroupSplitMode;

  @ApiPropertyOptional({ type: [String], description: 'Equal split: who shares it' })
  @IsOptional()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxMembers)
  @IsUUID('all', { each: true })
  memberIds?: string[];

  @ApiPropertyOptional({ type: [ShareInputDto], description: 'Exact split: each member’s amount' })
  @IsOptional()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxMembers)
  @ValidateNested({ each: true })
  @Type(() => ShareInputDto)
  shares?: ShareInputDto[];
}

export class SavePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toId: string;

  @ApiProperty({ example: 255_000, description: 'Integer paise' })
  @IsInt()
  @Min(1)
  @Max(maxAmountPaise)
  amountPaise: number;

  @ApiProperty({ example: '2026-11-20', description: 'IST day, not in the future' })
  @Validate(IsDayKey)
  day: string;
}

export class ActivityQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  cursor?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ---- Responses ----

export class GroupMemberDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Ravi' }) name: string;
  @ApiProperty({ description: 'The owner, shown as "You"' }) isSelf: boolean;
}

export class GroupBalanceDto {
  @ApiProperty({ format: 'uuid' }) memberId: string;
  @ApiProperty({ description: 'Positive: gets money back. Negative: owes.' }) netPaise: number;
}

export class GroupTransferDto {
  @ApiProperty({ format: 'uuid' }) fromId: string;
  @ApiProperty({ format: 'uuid' }) toId: string;
  @ApiProperty() amountPaise: number;
}

export class GroupSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Goa trip' }) name: string;
  @ApiProperty({ type: String, nullable: true, example: '🏖️' }) emoji: string | null;
  @ApiProperty() memberCount: number;
  @ApiProperty({ description: "The owner's net balance in the group" }) myNetPaise: number;
  @ApiProperty() archived: boolean;
}

export class GroupListDto {
  @ApiProperty({ type: [GroupSummaryDto] }) items: GroupSummaryDto[];
}

export class GroupDetailDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) emoji: string | null;
  @ApiProperty() archived: boolean;
  @ApiProperty({ type: [GroupMemberDto], description: 'In member order; "You" first' }) members: GroupMemberDto[];
  @ApiProperty({ type: [GroupBalanceDto] }) balances: GroupBalanceDto[];
  @ApiProperty({ type: [GroupTransferDto], description: 'Fewest payments that settle everyone' }) transfers: GroupTransferDto[];
  @ApiProperty() settled: boolean;
  @ApiProperty() totalSpentPaise: number;
  @ApiProperty() mySharePaise: number;
  @ApiProperty() myNetPaise: number;
}

export class GroupShareDto {
  @ApiProperty({ format: 'uuid' }) memberId: string;
  @ApiProperty() sharePaise: number;
}

/** One row of a group's activity: an expense or a payment, told apart by `kind`. */
export class GroupActivityDto {
  @ApiProperty({ enum: ['expense', 'payment'], enumName: 'GroupActivityKind' }) kind: 'expense' | 'payment';
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2026-11-20' }) day: string;
  @ApiProperty() amountPaise: number;
  @ApiPropertyOptional({ description: 'Expense only' }) description?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Expense only' }) paidById?: string;
  @ApiPropertyOptional({ enum: GROUP_SPLIT_MODES, enumName: 'GroupSplitMode', description: 'Expense only' }) splitMode?: GroupSplitMode;
  @ApiPropertyOptional({ type: [GroupShareDto], description: 'Expense only' }) shares?: GroupShareDto[];
  @ApiPropertyOptional({ format: 'uuid', description: 'Payment only' }) fromId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Payment only' }) toId?: string;
}

export class GroupActivityListDto {
  @ApiProperty({ type: [GroupActivityDto] }) items: GroupActivityDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor: string | null;
}
