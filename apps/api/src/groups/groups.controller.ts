import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
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
import {
  ActivityQueryDto,
  CreateGroupDto,
  GroupActivityDto,
  GroupActivityListDto,
  GroupDetailDto,
  GroupListDto,
  GroupListQueryDto,
  GroupMemberDto,
  MemberNameDto,
  SaveExpenseDto,
  SavePaymentDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { GroupsService } from './groups.service';

const Id = () => Param('id', ParseUUIDPipe);

@ApiTags('groups')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @ApiOperation({ operationId: 'listGroups', summary: "The caller's groups with their net balance in each, most recently used first" })
  @ApiOkResponse({ type: GroupListDto })
  async list(@CurrentUser() user: AuthUser, @Query() query: GroupListQueryDto): Promise<GroupListDto> {
    return { items: await this.groups.list(user.id, query.archived ?? false) };
  }

  @Post()
  @ApiOperation({ operationId: 'createGroup', summary: 'Create a group; the caller joins as "You"' })
  @ApiCreatedResponse({ type: GroupDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GROUP_LIMIT or GROUP_MEMBER_DUPLICATE' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto): Promise<GroupDetailDto> {
    return this.groups.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getGroup', summary: 'A group with members, balances and who pays whom' })
  @ApiOkResponse({ type: GroupDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  get(@CurrentUser() user: AuthUser, @Id() id: string): Promise<GroupDetailDto> {
    return this.groups.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateGroup', summary: 'Rename, archive or restore a group' })
  @ApiOkResponse({ type: GroupDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GROUP_LIMIT when restoring' })
  update(@CurrentUser() user: AuthUser, @Id() id: string, @Body() dto: UpdateGroupDto): Promise<GroupDetailDto> {
    return this.groups.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteGroup', summary: 'Delete a group with its members, expenses and payments' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@CurrentUser() user: AuthUser, @Id() id: string): Promise<void> {
    return this.groups.remove(user.id, id);
  }

  @Post(':id/members')
  @ApiOperation({ operationId: 'addGroupMember', summary: 'Add a member by name' })
  @ApiCreatedResponse({ type: GroupMemberDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GROUP_MEMBER_DUPLICATE or GROUP_MEMBER_LIMIT' })
  addMember(@CurrentUser() user: AuthUser, @Id() id: string, @Body() dto: MemberNameDto): Promise<GroupMemberDto> {
    return this.groups.addMember(user.id, id, dto.name);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ operationId: 'renameGroupMember', summary: 'Rename a member' })
  @ApiOkResponse({ type: GroupMemberDto })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'GROUP_MEMBER_SELF' })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GROUP_MEMBER_DUPLICATE' })
  renameMember(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: MemberNameDto,
  ): Promise<GroupMemberDto> {
    return this.groups.renameMember(user.id, id, memberId, dto.name);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'removeGroupMember', summary: 'Remove a member who is in no expense or payment' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'GROUP_MEMBER_SELF' })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GROUP_MEMBER_IN_USE' })
  removeMember(@CurrentUser() user: AuthUser, @Id() id: string, @Param('memberId', ParseUUIDPipe) memberId: string): Promise<void> {
    return this.groups.removeMember(user.id, id, memberId);
  }

  @Get(':id/activity')
  @ApiOperation({ operationId: 'listGroupActivity', summary: 'Expenses and payments, newest first' })
  @ApiOkResponse({ type: GroupActivityListDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  activity(@CurrentUser() user: AuthUser, @Id() id: string, @Query() query: ActivityQueryDto): Promise<GroupActivityListDto> {
    return this.groups.activity(user.id, id, query.cursor, query.limit ?? 50);
  }

  @Post(':id/expenses')
  @ApiOperation({ operationId: 'createGroupExpense', summary: 'Add an expense: who paid and who shares it' })
  @ApiCreatedResponse({ type: GroupActivityDto })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'GROUP_SPLIT_MISMATCH, GROUP_UNKNOWN_MEMBER or VALIDATION_FAILED' })
  @ApiNotFoundResponse({ type: ErrorResponse })
  createExpense(@CurrentUser() user: AuthUser, @Id() id: string, @Body() dto: SaveExpenseDto): Promise<GroupActivityDto> {
    return this.groups.createExpense(user.id, id, dto);
  }

  @Put(':id/expenses/:expenseId')
  @ApiOperation({ operationId: 'updateGroupExpense', summary: 'Replace an expense' })
  @ApiOkResponse({ type: GroupActivityDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  updateExpense(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: SaveExpenseDto,
  ): Promise<GroupActivityDto> {
    return this.groups.updateExpense(user.id, id, expenseId, dto);
  }

  @Delete(':id/expenses/:expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteGroupExpense', summary: 'Delete an expense' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  removeExpense(@CurrentUser() user: AuthUser, @Id() id: string, @Param('expenseId', ParseUUIDPipe) expenseId: string): Promise<void> {
    return this.groups.removeExpense(user.id, id, expenseId);
  }

  @Post(':id/payments')
  @ApiOperation({ operationId: 'createGroupPayment', summary: 'Record that one member paid another back' })
  @ApiCreatedResponse({ type: GroupActivityDto })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'GROUP_PAYMENT_SAME_MEMBER or GROUP_UNKNOWN_MEMBER' })
  @ApiNotFoundResponse({ type: ErrorResponse })
  createPayment(@CurrentUser() user: AuthUser, @Id() id: string, @Body() dto: SavePaymentDto): Promise<GroupActivityDto> {
    return this.groups.createPayment(user.id, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteGroupPayment', summary: 'Delete a payment' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  removePayment(@CurrentUser() user: AuthUser, @Id() id: string, @Param('paymentId', ParseUUIDPipe) paymentId: string): Promise<void> {
    return this.groups.removePayment(user.id, id, paymentId);
  }
}
