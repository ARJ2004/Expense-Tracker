import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { CaptureService } from './capture.service';
import { IngestBatchDto, IngestBatchResultDto } from './dto/ingest-batch.dto';
import { SourceStatsDto } from './dto/source-stats.dto';
import { SourceStatsService } from './source-stats.service';
import { tunables } from '../config/tunables';

/**
 * HTTP edge for transactions the phone captured (writes go through IngestService.ingestBatch),
 * and what each source has added (the Data sources screen).
 */
@ApiTags('ingest')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('ingest')
export class IngestController {
  constructor(
    private readonly capture: CaptureService,
    private readonly sourceStats: SourceStatsService,
  ) {}

  @Get('sources')
  @ApiOperation({ operationId: 'sourceStats', summary: 'Transactions and last activity per source (bank SMS, statements, manual)' })
  @ApiOkResponse({ type: SourceStatsDto })
  async sources(@CurrentUser() user: AuthUser): Promise<SourceStatsDto> {
    return { items: await this.sourceStats.forUser(user.id) };
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: tunables.rateLimits.ingestBatch })
  @ApiTooManyRequestsResponse({ type: ErrorResponse, description: 'RATE_LIMITED' })
  @ApiOperation({
    operationId: 'ingestBatch',
    summary: 'Up to 100 transactions parsed on the phone (bank SMS); idempotent by messageKey',
  })
  @ApiOkResponse({ type: IngestBatchResultDto })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'VALIDATION_FAILED' })
  batch(@CurrentUser() user: AuthUser, @Body() dto: IngestBatchDto): Promise<IngestBatchResultDto> {
    return this.capture.ingestCaptured(user.id, dto.items);
  }
}
