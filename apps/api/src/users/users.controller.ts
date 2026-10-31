import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { istDateKey } from '@et/domain';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { LedgerQueryService } from '../ingest';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { MeDto } from './dto/me.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { csvHeader, csvLine } from './domain/export-csv';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly ledger: LedgerQueryService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'getMe', summary: 'The signed-in user' })
  @ApiOkResponse({ type: MeDto })
  getMe(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.getMe(user.id);
  }

  @Patch()
  @ApiOperation({ operationId: 'updateMe', summary: 'Edit profile: name, monthly income (paise), income frequency' })
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<MeDto> {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'completeOnboarding', summary: 'Save income answers and finish onboarding' })
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'ALREADY_ONBOARDED' })
  completeOnboarding(@CurrentUser() user: AuthUser, @Body() dto: CompleteOnboardingDto): Promise<MeDto> {
    return this.users.completeOnboarding(user.id, dto);
  }

  @Get('export')
  @ApiOperation({ operationId: 'exportLedger', summary: 'Download every transaction as a CSV (oldest first)' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV of the full ledger', schema: { type: 'string', format: 'binary' } })
  async exportLedger(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<void> {
    const filename = `expense-tracker-export-${istDateKey(new Date())}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Stream row by row: exportRows pages the ledger 500 at a time, so a long history never
    // sits in memory and the response starts flushing immediately.
    res.write(csvHeader());
    for await (const row of this.ledger.exportRows(user.id)) {
      res.write(csvLine(row));
    }
    res.end();
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteMe', summary: 'Permanently delete the account and all its data' })
  @ApiNoContentResponse({ description: 'Account and all owned data removed' })
  async deleteMe(@CurrentUser() user: AuthUser): Promise<void> {
    await this.users.deleteAccount(user.id);
  }
}
