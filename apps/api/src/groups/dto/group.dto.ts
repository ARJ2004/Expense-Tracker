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

  /** The creator's own name in the group, as everyone else will see it ("Asha"). */
  @ApiPropertyOptional({ example: 'Asha', description: 'Defaults to "Me"' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(memberNameLength.min, memberNameLength.max)
  myName?: string;

  /** Other members' names; the creator is added as a linked member. */
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

  @ApiPropertyOptional({ description: 'Archive to hide it from your own list, or bring it back. Only affects you.' })
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

  /** Create only: makes a retry (flaky network, double tap) return the first result instead of adding it twice. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  /** Edit only: the version that was read. Someone else saved in between → 409 GROUP_EXPENSE_CHANGED. */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class VersionQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'The version that was read; a newer one → 409' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
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

  @ApiPropertyOptional({ format: 'uuid', description: 'Makes a retry return the first result' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}

export class TransferOwnerDto {
  @ApiProperty({ format: 'uuid', description: 'A joined member' })
  @IsUUID()
  memberId: string;
}

export class InviteOptionsDto {
  @ApiPropertyOptional({ description: 'Turn the current link off and make a new one (owner only)' })
  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}

export class AcceptInviteDto {
  /** Claim this name ("I'm Ravi"): it must not be linked to anyone yet. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  /** Join as a new member under this name (made unique: "Ravi 2"). Ignored with memberId. */
  @ApiPropertyOptional({ example: 'Ravi' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(memberNameLength.min, memberNameLength.max)
  name?: string;
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
  @ApiProperty({ description: 'This member is the caller, shown as "You"' }) isSelf: boolean;
  @ApiProperty({ description: 'Linked to an Altus user who joined' }) joined: boolean;
  @ApiProperty({ description: 'Owns the group' }) isOwner: boolean;
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
  @ApiProperty({ description: "The caller's net balance in the group" }) myNetPaise: number;
  @ApiProperty({ description: 'Archived by the caller' }) archived: boolean;
  @ApiProperty({ description: 'Changes with every write to the group' }) rev: number;
}

export class GroupListDto {
  @ApiProperty({ type: [GroupSummaryDto] }) items: GroupSummaryDto[];
}

export class GroupDetailDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) emoji: string | null;
  @ApiProperty({ description: 'Archived by the caller' }) archived: boolean;
  @ApiProperty({ description: 'Changes with every write to the group' }) rev: number;
  @ApiProperty({ format: 'uuid', description: "The caller's member" }) myMemberId: string;
  @ApiProperty({ description: 'The caller owns the group' }) isOwner: boolean;
  @ApiProperty({ type: [GroupMemberDto], description: 'In member order' }) members: GroupMemberDto[];
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
  @ApiPropertyOptional({ description: 'Expense only: send it back when editing' }) version?: number;
  @ApiPropertyOptional({ format: 'uuid', description: 'Payment only' }) fromId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Payment only' }) toId?: string;
}

export class GroupActivityListDto {
  @ApiProperty({ type: [GroupActivityDto] }) items: GroupActivityDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor: string | null;
}

export class InviteDto {
  @ApiProperty({ example: 'K7Q2M9XP4R' }) code: string;
  @ApiProperty({ example: 'K7Q2-M9XP4R' }) displayCode: string;
  @ApiProperty({ example: 'http://15.252.181.82/altus/j/K7Q2M9XP4R' }) url: string;
}

export class InviteStateDto {
  @ApiProperty({ description: 'A link is on' }) active: boolean;
  @ApiPropertyOptional({ type: InviteDto }) invite?: InviteDto;
}

export class InviteMemberDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() joined: boolean;
}

export class InvitePreviewDto {
  @ApiProperty({ format: 'uuid' }) groupId: string;
  @ApiProperty() groupName: string;
  @ApiProperty({ type: String, nullable: true }) emoji: string | null;
  @ApiProperty({ description: "The owner's name in the group" }) invitedBy: string;
  @ApiProperty({ type: [InviteMemberDto] }) members: InviteMemberDto[];
  @ApiProperty({ description: 'The caller is already in the group' }) alreadyMember: boolean;
}

export class PublicInvitePreviewDto {
  @ApiProperty() groupName: string;
  @ApiProperty({ type: String, nullable: true }) emoji: string | null;
  @ApiProperty() invitedBy: string;
}

export class GroupHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'expense.updated' }) type: string;
  @ApiProperty({ type: String, nullable: true, description: 'Who did it, by their name in the group' }) actorName: string | null;
  @ApiProperty({ description: 'The caller did it (shown as "You")' }) actorIsSelf: boolean;
  @ApiProperty({ example: 'changed Dinner from ₹3,600 to ₹3,200' }) text: string;
  @ApiProperty() createdAt: string;
}

export class GroupHistoryListDto {
  @ApiProperty({ type: [GroupHistoryItemDto] }) items: GroupHistoryItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor: string | null;
}
