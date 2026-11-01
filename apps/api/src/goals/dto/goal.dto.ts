import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { GOAL_LIMITS, MAX_AMOUNT_PAISE, type GoalDayStatus } from '@et/domain';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GOAL_STATUSES = ['active', 'reached', 'archived'] as const;
export type GoalStatusName = (typeof GOAL_STATUSES)[number];
const DAY_STATUSES: GoalDayStatus[] = ['met', 'covered', 'missed', 'pending', 'none'];

export class CreateGoalDto {
  @ApiProperty({ example: 'New phone' })
  @Transform(trim)
  @IsString()
  @Length(GOAL_LIMITS.nameLength.min, GOAL_LIMITS.nameLength.max)
  name: string;

  @ApiPropertyOptional({ example: '📱' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  emoji?: string;

  @ApiProperty({ example: 5_000_000, description: 'Integer paise' })
  @IsInt()
  @Min(GOAL_LIMITS.minTargetPaise)
  @Max(GOAL_LIMITS.maxTargetPaise)
  targetPaise: number;

  /** The IST day it is wanted by: tomorrow at the earliest, at most 10 years ahead. */
  @ApiProperty({ example: '2027-01-30', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @Matches(DAY, { message: 'targetDay must be a date like 2027-01-30' })
  targetDay: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: 'New phone' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(GOAL_LIMITS.nameLength.min, GOAL_LIMITS.nameLength.max)
  name?: string;

  @ApiPropertyOptional({ example: '📱', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  emoji?: string;

  @ApiPropertyOptional({ example: 5_000_000 })
  @IsOptional()
  @IsInt()
  @Min(GOAL_LIMITS.minTargetPaise)
  @Max(GOAL_LIMITS.maxTargetPaise)
  targetPaise?: number;

  @ApiPropertyOptional({ example: '2027-01-30', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @IsOptional()
  @Matches(DAY, { message: 'targetDay must be a date like 2027-01-30' })
  targetDay?: string;

  /** Archive to hide it, or bring an archived goal back. Reached is set by saving, never here. */
  @ApiPropertyOptional({ enum: ['active', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export class ContributeDto {
  @ApiProperty({ example: 55_600, description: 'Integer paise' })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_PAISE)
  amountPaise: number;

  /** Which IST day it counts for: today, or yesterday if it wasn't logged in time. */
  @ApiPropertyOptional({ enum: ['today', 'yesterday'], description: 'Defaults to today' })
  @IsOptional()
  @IsIn(['today', 'yesterday'])
  day?: 'today' | 'yesterday';
}

export class GoalStatusQueryDto {
  @ApiPropertyOptional({ enum: GOAL_STATUSES })
  @IsOptional()
  @IsIn(GOAL_STATUSES)
  status?: GoalStatusName;
}

export class GoalDayDto {
  @ApiProperty({ example: '2026-11-01' })
  day: string;

  @ApiProperty({ enum: DAY_STATUSES, enumName: 'GoalDayStatus' })
  status: GoalDayStatus;
}

export class GoalProgressDto {
  @ApiProperty() savedPaise: number;
  @ApiProperty() remainingPaise: number;
  @ApiProperty({ description: 'Target ÷ saving days, rounded up to a whole rupee' }) dailyTargetPaise: number;
  @ApiProperty({ description: 'What to save today to stay on plan' }) suggestedTodayPaise: number;
  @ApiProperty() savedTodayPaise: number;
  @ApiProperty() daysLeft: number;
  @ApiProperty({ description: '"12 days closer"' }) daysCloser: number;
  @ApiProperty({ description: '"78 to go"' }) daysToGo: number;
  @ApiProperty({ description: 'Days ahead (positive) or behind (negative) of plan' }) scheduleDelta: number;
  @ApiProperty() streak: number;
  @ApiProperty() bestStreak: number;
  @ApiProperty() reached: boolean;
  @ApiProperty() overdue: boolean;
  @ApiProperty({ type: [String], example: ['saved-25', 'streak-3'] }) milestones: string[];
  @ApiProperty({ type: [GoalDayDto] }) last14: GoalDayDto[];
}

export class GoalDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'New phone' }) name: string;
  @ApiProperty({ type: String, nullable: true, example: '📱' }) emoji: string | null;
  @ApiProperty({ example: 5_000_000 }) targetPaise: number;
  @ApiProperty({ example: '2026-11-01' }) startDay: string;
  @ApiProperty({ example: '2027-01-30' }) targetDay: string;
  @ApiProperty({ enum: GOAL_STATUSES, enumName: 'GoalStatus' }) status: GoalStatusName;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) reachedAt: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: GoalProgressDto }) progress: GoalProgressDto;
}

export class GoalListDto {
  @ApiProperty({ type: [GoalDto] }) items: GoalDto[];
}

export class GoalContributionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2026-11-01' }) day: string;
  @ApiProperty({ example: 55_600 }) amountPaise: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class GoalDetailDto extends GoalDto {
  @ApiProperty({ type: [GoalContributionDto], description: 'Newest first, the last 90' }) contributions: GoalContributionDto[];
}

export class ContributionResultDto {
  @ApiProperty({ type: GoalDto }) goal: GoalDto;
  @ApiProperty({ type: [String], description: 'Milestones this contribution reached, to celebrate', example: ['saved-50'] }) newMilestones: string[];
}
