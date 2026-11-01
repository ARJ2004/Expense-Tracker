import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppError, CurrentUser, ErrorResponse, type AuthUser } from '../common';
import {
  ImportDto,
  ImportListDto,
  ImportRowDto,
  ImportRowListDto,
  RowsQueryDto,
  UpdateImportDto,
  UnlockImportDto,
  UpdateImportRowDto,
  UploadImportDto,
  UploadResultDto,
} from './dto/import.dto';
import { FileTooLargeFilter, MAX_UPLOAD_BYTES } from './file-too-large.filter';
import { ImportsService, type UploadedFile as Upload } from './imports.service';
import { tunables } from '../config/tunables';

@ApiTags('imports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: tunables.rateLimits.upload })
  @UseFilters(FileTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @ApiOperation({ operationId: 'uploadImport', summary: 'Upload a CSV, XLSX or text PDF statement; it is parsed in the background' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' }, accountId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiAcceptedResponse({ type: UploadResultDto })
  @ApiPayloadTooLargeResponse({ type: ErrorResponse, description: 'FILE_TOO_LARGE (over 10 MB)' })
  @ApiUnsupportedMediaTypeResponse({ type: ErrorResponse, description: 'IMPORT_UNSUPPORTED_FORMAT' })
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Upload | undefined, @Body() dto: UploadImportDto): Promise<UploadResultDto> {
    if (!file) throw new AppError('VALIDATION_FAILED', 'Attach the statement as "file"', HttpStatus.BAD_REQUEST);
    return this.imports.upload(user.id, file, dto.accountId);
  }

  @Get()
  @ApiOperation({ operationId: 'listImports', summary: 'The latest 20 imports, newest first' })
  @ApiOkResponse({ type: ImportListDto })
  async list(@CurrentUser() user: AuthUser): Promise<ImportListDto> {
    return { items: await this.imports.list(user.id) };
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getImport' })
  @ApiOkResponse({ type: ImportDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ImportDto> {
    return this.imports.get(user.id, id);
  }

  @Get(':id/rows')
  @ApiOperation({ operationId: 'listImportRows' })
  @ApiOkResponse({ type: ImportRowListDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  async rows(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: RowsQueryDto): Promise<ImportRowListDto> {
    return { items: await this.imports.rows(user.id, id, query.filter) };
  }

  @Patch(':id/rows/:rowNo')
  @ApiOperation({ operationId: 'updateImportRow', summary: 'Tick or untick a row, pick its category, or correct it' })
  @ApiOkResponse({ type: ImportRowDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'IMPORT_NOT_IN_REVIEW' })
  updateRow(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowNo', ParseIntPipe) rowNo: number,
    @Body() dto: UpdateImportRowDto,
  ): Promise<ImportRowDto> {
    return this.imports.updateRow(user.id, id, rowNo, dto);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'setImportAccount', summary: 'Pick the account; the duplicate check runs again' })
  @ApiOkResponse({ type: ImportDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'IMPORT_NOT_IN_REVIEW' })
  setAccount(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateImportDto): Promise<ImportDto> {
    return this.imports.setAccount(user.id, id, dto.accountId);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: tunables.rateLimits.unlock })
  @ApiOperation({ operationId: 'unlockImport', summary: 'Open a password-protected PDF statement and parse it; the password is never stored' })
  @ApiOkResponse({ type: ImportDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'IMPORT_NOT_LOCKED' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: 'IMPORT_WRONG_PASSWORD' })
  @ApiTooManyRequestsResponse({ type: ErrorResponse })
  unlock(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UnlockImportDto): Promise<ImportDto> {
    return this.imports.unlock(user.id, id, dto.password);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'confirmImport', summary: 'Add the ticked rows to the ledger in one transaction' })
  @ApiOkResponse({ type: ImportDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'IMPORT_NOT_IN_REVIEW or ACCOUNT_REQUIRED' })
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ImportDto> {
    return this.imports.confirm(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'discardImport', summary: 'Discard an import that was not added' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'IMPORT_ALREADY_CONFIRMED' })
  discard(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.imports.discard(user.id, id);
  }
}
