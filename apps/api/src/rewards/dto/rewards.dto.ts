import { ApiProperty } from '@nestjs/swagger';
import { BADGE_CODES, type BadgeCode } from '@et/domain';

export class StreakDto {
  @ApiProperty({ example: 6, description: 'Days in a row within the daily allowance, ending yesterday' })
  current: number;

  @ApiProperty({ example: 11 })
  best: number;
}

export class BadgeDto {
  @ApiProperty({ enum: BADGE_CODES, enumName: 'BadgeCode' })
  code: BadgeCode;

  @ApiProperty({ example: '🔥' })
  emoji: string;

  @ApiProperty({ example: '3-day streak' })
  title: string;

  @ApiProperty({ example: '3 days in a row within your allowance' })
  description: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Null while locked' })
  unlockedAt: string | null;
}

export class DayOutcomeDto {
  @ApiProperty({ format: 'date', example: '2026-11-10' })
  day: string;

  @ApiProperty({ example: 64_000 })
  allowancePaise: number;

  @ApiProperty({ example: 41_000 })
  spentPaise: number;

  @ApiProperty()
  underBudget: boolean;
}

export class RewardsDto {
  @ApiProperty({ type: StreakDto })
  streak: StreakDto;

  @ApiProperty({ type: [DayOutcomeDto], description: 'The last 14 closed days, oldest first (missing days are absent)' })
  last14: DayOutcomeDto[];

  @ApiProperty({ type: [BadgeDto], description: 'Every badge, unlocked or not, in display order' })
  badges: BadgeDto[];
}
