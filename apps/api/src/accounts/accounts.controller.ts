import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { AccountsService } from './accounts.service';
import { AccountDto, AccountListDto, CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@ApiTags('accounts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ operationId: 'listAccounts', summary: "The caller's accounts, oldest first" })
  @ApiOkResponse({ type: AccountListDto })
  async list(@CurrentUser() user: AuthUser): Promise<AccountListDto> {
    return { items: await this.accounts.list(user.id) };
  }

  @Post()
  @ApiOperation({ operationId: 'createAccount', summary: 'Add a bank account, card, wallet or cash' })
  @ApiCreatedResponse({ type: AccountDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'ACCOUNT_EXISTS' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto): Promise<AccountDto> {
    return this.accounts.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateAccount', summary: 'Edit an account' })
  @ApiOkResponse({ type: AccountDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'ACCOUNT_EXISTS' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto): Promise<AccountDto> {
    return this.accounts.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteAccount', summary: 'Delete an account that has no transactions' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'ACCOUNT_IN_USE' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.accounts.remove(user.id, id);
  }
}
