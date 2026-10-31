import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { CaptureService } from './capture.service';
import { IngestBatchDto, IngestBatchResultDto } from './dto/ingest-batch.dto';

/** HTTP edge for transactions the phone captured. Writes go through IngestService.ingestBatch. */
@ApiTags('ingest')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('ingest')
export class IngestController {
  constructor(private readonly capture: CaptureService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  // A first sync of 90 days is a handful of batches; 60 a minute leaves room and caps a runaway loop.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
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
