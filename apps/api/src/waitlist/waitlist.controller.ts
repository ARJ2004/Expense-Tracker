import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadRequestResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ErrorResponse, Public } from '../common';
import { tunables } from '../config/tunables';
import { JoinWaitlistDto, WaitlistAcceptedDto } from './dto/join-waitlist.dto';
import { WaitlistService } from './waitlist.service';

/** Where a plain HTML form post (no JavaScript) lands afterwards: the website's Download page. */
export const WAITLIST_DONE_PATH = '/download?waitlist=ok#iphone';

@ApiTags('waitlist')
@Throttle({ default: tunables.rateLimits.waitlist })
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ operationId: 'joinWaitlist', summary: 'Public: join the iPhone waitlist from the website' })
  @ApiAcceptedResponse({ type: WaitlistAcceptedDto, description: 'Same answer for a new or a repeated address' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'VALIDATION_FAILED' })
  @ApiTooManyRequestsResponse({ type: ErrorResponse })
  async join(
    @Body() dto: JoinWaitlistDto,
    @Headers('accept') accept: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WaitlistAcceptedDto | void> {
    if (!dto.website) await this.waitlist.join(dto);
    // A browser posting the form without JavaScript asks for HTML: send it back to the page.
    if (accept?.includes('text/html')) {
      res.redirect(HttpStatus.SEE_OTHER, WAITLIST_DONE_PATH);
      return;
    }
    return { status: 'ok' };
  }
}
