import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min, Validate } from 'class-validator';
import { BUDGET_LIMITS, type BudgetState } from '@et/domain';
import { IsMonthKey } from '../../common';
import { TransactionCategoryDto } from '../../ingest';

export const BUDGET_STATES: BudgetState[] = ['ok', 'warning', 'over'];
export const ALLOWANCE_BASES = ['income', 'budgets'] as const;

export class BudgetMonthQueryDto {
  @ApiPropertyOptional({ example: '2026-11', description: 'IST calendar month; defaults to the current one' })
  @IsOptional()
  @Validate(IsMonthKey)
  month?: string;
}

export class SetBudgetDto {
  @ApiProperty({ example: 800_000, description: 'Monthly limit in integer paise' })
  @IsInt()
  @Min(BUDGET_LIMITS.minPaise)
  @Max(BUDGET_LIMITS.maxPaise)
  amountPaise: number;

  @ApiPropertyOptional({ description: 'Rent, EMIs: money that goes anyway, held back in full from the daily allowance', default: false })
  @IsOptional()
  @IsBoolean()
  isFixed?: boolean;
}

export class BudgetDto {
  @ApiProperty({ type: TransactionCategoryDto })
  category: TransactionCategoryDto;

  @ApiProperty({ example: 800_000 })
  amountPaise: number;

  @ApiProperty()
  isFixed: boolean;

  @ApiProperty({ example: 652_000, description: 'Spend in the category this month, refunds taken off' })
  spentPaise: number;

  @ApiProperty({ example: 81, description: 'Whole percent of the budget used, rounded down' })
  usedPercent: number;

  @ApiProperty({ enum: BUDGET_STATES, enumName: 'BudgetState', description: 'warning from 80%, over once spend passes the budget; a fixed budget paid in full is ok' })
  state: BudgetState;

  @ApiProperty({ type: Number, nullable: true, example: 980_000, description: 'Month-end spend at this pace; null in the first days or for past months' })
  projectedPaise: number | null;

  @ApiProperty({ example: 180_000, description: 'How far over the budget the pace points; 0 when on track' })
  overshootPaise: number;
}

export class AllowanceDto {
  @ApiProperty({ format: 'date', example: '2026-11-11' })
  day: string;

  @ApiProperty({ example: 64_000, description: 'What can be spent today and still end the month on plan' })
  allowancePaise: number;

  @ApiProperty({ example: 12_000, description: "Today's spend outside fixed categories" })
  spentTodayPaise: number;

  @ApiProperty({ example: 52_000, description: 'allowance − spent today; negative when over' })
  leftTodayPaise: number;

  @ApiProperty({ example: 20, description: 'Days left in the month, today included' })
  daysLeft: number;

  @ApiProperty({ enum: ALLOWANCE_BASES, enumName: 'AllowanceBasis', description: 'income: from the monthly income; budgets: the sum of budgets, when there is no income' })
  basis: (typeof ALLOWANCE_BASES)[number];

  @ApiProperty({ example: 1_500_000, description: 'Fixed budgets held back this month' })
  fixedReservePaise: number;

  @ApiProperty({ example: 1_668_000, description: 'What active goals ask to be put aside this month' })
  goalReservePaise: number;
}

export class BudgetOverviewDto {
  @ApiProperty({ example: '2026-11' })
  month: string;

  @ApiProperty({ type: [BudgetDto], description: 'Fixed budgets last, then by most used' })
  items: BudgetDto[];

  @ApiProperty({ example: 4_000_000 })
  totalBudgetPaise: number;

  @ApiProperty({ example: 2_210_000, description: 'Spend in budgeted categories this month' })
  totalSpentPaise: number;

  @ApiProperty({ example: 340_000, description: 'Spend this month in categories with no budget' })
  unbudgetedSpentPaise: number;

  @ApiProperty({ type: AllowanceDto, nullable: true, description: 'Only for the current month, and only with an income or at least one budget' })
  allowance: AllowanceDto | null;
}
