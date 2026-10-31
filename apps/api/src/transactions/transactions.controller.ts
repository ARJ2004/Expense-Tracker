import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { paise } from '@et/domain';
import { AppError, CurrentUser, ErrorResponse, type AuthUser } from '../common';
import {
  IngestService,
  LedgerQueryService,
  RecategorizeResultDto,
  RecentCategoriesDto,
  TransactionDetailDto,
  TransactionPageDto,
  TransactionSummaryListDto,
} from '../ingest';
import { LedgerQueryDto, RecategorizeDto } from './dto/ledger-query.dto';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/write-transaction.dto';

const MAX_FUTURE_MS = 86_400_000;

/** HTTP edge of the ledger: writes go to IngestService, reads to LedgerQueryService. */
@ApiTags('transactions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly ingest: IngestService,
    private readonly ledger: LedgerQueryService,
  ) {}

  @Post()
  @ApiOperation({ operationId: 'createTransaction', summary: 'Manual entry (idempotent by clientRequestId)' })
  @ApiCreatedResponse({ type: TransactionDetailDto, description: 'Created' })
  @ApiOkResponse({ type: TransactionDetailDto, description: 'Same clientRequestId seen before; the original is returned' })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'Account or category not found' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransactionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionDetailDto> {
    const { transactionId, created } = await this.ingest.ingest(
      user.id,
      {
        source: 'manual',
        amountPaise: paise(dto.amountPaise),
        direction: dto.direction,
        occurredAt: notInFuture(dto.occurredAt),
        timePrecision: 'minute',
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        counterparty: dto.merchantName,
        note: dto.note,
      },
      { kind: 'manual', clientRequestId: dto.clientRequestId },
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return this.ledger.get(user.id, transactionId);
  }

  @Get()
  @ApiOperation({ operationId: 'listTransactions', summary: 'The ledger, newest first, with filters, search and day totals' })
  @ApiOkResponse({ type: TransactionPageDto })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'VALIDATION_FAILED or INVALID_CURSOR' })
  list(@CurrentUser() user: AuthUser, @Query() query: LedgerQueryDto): Promise<TransactionPageDto> {
    if (query.from && query.to && query.from > query.to) {
      throw new AppError('VALIDATION_FAILED', 'from must be on or before to', HttpStatus.BAD_REQUEST);
    }
    if (query.minAmountPaise !== undefined && query.maxAmountPaise !== undefined && query.minAmountPaise > query.maxAmountPaise) {
      throw new AppError('VALIDATION_FAILED', 'minAmountPaise must not be more than maxAmountPaise', HttpStatus.BAD_REQUEST);
    }
    const { cursor, limit, categoryId, ...filters } = query;
    return this.ledger.list(user.id, { ...filters, categoryIds: categoryId }, cursor, limit ?? 50);
  }

  @Get('recent')
  @ApiOperation({ operationId: 'listRecentTransactions', summary: 'Newest transactions (until the full ledger list in Sprint 4)' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 20, default: 5 } })
  @ApiOkResponse({ type: TransactionSummaryListDto })
  async recent(
    @CurrentUser() user: AuthUser,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<TransactionSummaryListDto> {
    return { items: await this.ledger.recent(user.id, Math.min(20, Math.max(1, limit))) };
  }

  @Get('recent-categories')
  @ApiOperation({ operationId: 'listRecentCategoryIds', summary: 'Categories the user picked most recently' })
  @ApiOkResponse({ type: RecentCategoriesDto })
  async recentCategories(@CurrentUser() user: AuthUser): Promise<RecentCategoriesDto> {
    return { ids: await this.ledger.recentCategoryIds(user.id) };
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getTransaction', summary: 'One transaction with its sources' })
  @ApiOkResponse({ type: TransactionDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TransactionDetailDto> {
    return this.ledger.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateTransaction', summary: 'Edit; amount, date or merchant changes set userEdited' })
  @ApiOkResponse({ type: TransactionDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDetailDto> {
    await this.ingest.edit(user.id, id, {
      amountPaise: dto.amountPaise,
      direction: dto.direction,
      occurredAt: dto.occurredAt ? notInFuture(dto.occurredAt) : undefined,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      merchantName: dto.merchantName,
      note: dto.note,
    });
    return this.ledger.get(user.id, id);
  }

  @Patch(':id/category')
  @ApiOperation({ operationId: 'recategorizeTransaction', summary: 'Change category; applyToMerchant saves a merchant rule and moves the other rows' })
  @ApiOkResponse({ type: RecategorizeResultDto })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'MERCHANT_REQUIRED when applyToMerchant is set on a row with no merchant' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'Transaction or category not found' })
  async recategorize(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecategorizeDto,
  ): Promise<RecategorizeResultDto> {
    const { updatedCount } = await this.ingest.recategorize(user.id, id, dto.categoryId, dto.applyToMerchant ?? false);
    return { transaction: await this.ledger.get(user.id, id), updatedCount };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteTransaction', summary: 'Soft delete' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.ingest.softDelete(user.id, id);
  }
}

function notInFuture(iso: string): Date {
  const at = new Date(iso);
  if (at.getTime() > Date.now() + MAX_FUTURE_MS) {
    throw new AppError('VALIDATION_FAILED', 'occurredAt cannot be more than a day in the future', HttpStatus.BAD_REQUEST);
  }
  return at;
}
