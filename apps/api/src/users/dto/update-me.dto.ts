import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { IncomeFrequency, MAX_AMOUNT_PAISE } from '@et/domain';

/**
 * Profile edits from Settings. Every field is optional; an empty body is a no-op that returns
 * the current profile. Income stays integer paise (never a float).
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Asha', minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 0, example: 8500000, description: 'Monthly income in paise' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_PAISE)
  monthlyIncomePaise?: number;

  @ApiPropertyOptional({ enum: Object.values(IncomeFrequency), enumName: 'IncomeFrequency' })
  @IsOptional()
  @IsIn(Object.values(IncomeFrequency))
  incomeFrequency?: IncomeFrequency;
}
