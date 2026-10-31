import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { AccountsService } from './accounts.service';
import { AccountDto, AccountListDto, CreateAccountDto } from './dto/account.dto';

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
}
