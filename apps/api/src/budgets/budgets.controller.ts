import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { BudgetsService } from './budgets.service';
import { BudgetDto, BudgetMonthQueryDto, BudgetOverviewDto, SetBudgetDto } from './dto/budget.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @ApiOperation({ operationId: 'getBudgets', summary: "A month's budgets with spend, pace and (this month) the daily allowance" })
  @ApiOkResponse({ type: BudgetOverviewDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  overview(@CurrentUser() user: AuthUser, @Query() query: BudgetMonthQueryDto): Promise<BudgetOverviewDto> {
    return this.budgets.overview(user.id, query.month);
  }

  @Put(':categoryId')
  @ApiOperation({ operationId: 'setBudget', summary: "Set or change a category's monthly budget" })
  @ApiOkResponse({ type: BudgetDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'BUDGET_LIMIT' })
  set(@CurrentUser() user: AuthUser, @Param('categoryId', ParseUUIDPipe) categoryId: string, @Body() dto: SetBudgetDto): Promise<BudgetDto> {
    return this.budgets.set(user.id, categoryId, dto);
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteBudget', summary: "Remove a category's budget" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@CurrentUser() user: AuthUser, @Param('categoryId', ParseUUIDPipe) categoryId: string): Promise<void> {
    return this.budgets.remove(user.id, categoryId);
  }
}
