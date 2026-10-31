import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto, DashboardTrendDto, SummaryQueryDto, TrendQueryDto } from './dto/dashboard.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@ApiBadRequestResponse({ type: ErrorResponse })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ operationId: 'getDashboardSummary', summary: "A month's spend, income, categories and merchants (IST)" })
  @ApiOkResponse({ type: DashboardSummaryDto })
  summary(@CurrentUser() user: AuthUser, @Query() query: SummaryQueryDto): Promise<DashboardSummaryDto> {
    return this.dashboard.summary(user.id, query.month);
  }

  @Get('trend')
  @ApiOperation({ operationId: 'getDashboardTrend', summary: 'Spend and income per day, week or month; empty buckets are zero' })
  @ApiOkResponse({ type: DashboardTrendDto })
  trend(@CurrentUser() user: AuthUser, @Query() query: TrendQueryDto): Promise<DashboardTrendDto> {
    return this.dashboard.trend(user.id, query.from, query.to, query.bucket);
  }
}
