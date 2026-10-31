import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IncomeFrequency } from '@et/domain';

/** Answers from onboarding step 1. Both are optional: the income step can be skipped. */
export class CompleteOnboardingDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 0, example: 8500000, description: 'Monthly income in paise' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  monthlyIncomePaise?: number;

  @ApiPropertyOptional({ enum: Object.values(IncomeFrequency), enumName: 'IncomeFrequency' })
  @IsOptional()
  @IsIn(Object.values(IncomeFrequency))
  incomeFrequency?: IncomeFrequency;
}
