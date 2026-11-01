import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
  ContributeDto,
  ContributionResultDto,
  CreateGoalDto,
  GoalDetailDto,
  GoalDto,
  GoalListDto,
  GoalStatusQueryDto,
  UpdateGoalDto,
} from './dto/goal.dto';
import { GoalsService } from './goals.service';

@ApiTags('goals')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  @ApiOperation({ operationId: 'listGoals', summary: "The caller's savings goals with progress, soonest deadline first" })
  @ApiOkResponse({ type: GoalListDto })
  async list(@CurrentUser() user: AuthUser, @Query() query: GoalStatusQueryDto): Promise<GoalListDto> {
    return { items: await this.goals.list(user.id, query.status) };
  }

  @Post()
  @ApiOperation({ operationId: 'createGoal', summary: 'Start saving for something' })
  @ApiCreatedResponse({ type: GoalDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GOAL_LIMIT' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoalDto): Promise<GoalDto> {
    return this.goals.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getGoal', summary: 'A goal with its progress and recent contributions' })
  @ApiOkResponse({ type: GoalDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<GoalDetailDto> {
    return this.goals.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateGoal', summary: 'Rename, change the target or date, archive or restore' })
  @ApiOkResponse({ type: GoalDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoalDto): Promise<GoalDto> {
    return this.goals.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteGoal', summary: 'Delete a goal and its contributions' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.goals.remove(user.id, id);
  }

  @Post(':id/contributions')
  @ApiOperation({ operationId: 'contributeToGoal', summary: 'Put money aside for today (or yesterday)' })
  @ApiCreatedResponse({ type: ContributionResultDto })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'GOAL_ARCHIVED or GOAL_REACHED' })
  contribute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContributeDto): Promise<ContributionResultDto> {
    return this.goals.contribute(user.id, id, dto);
  }

  @Delete(':id/contributions/:contributionId')
  @ApiOperation({ operationId: 'removeGoalContribution', summary: 'Take back a contribution' })
  @ApiOkResponse({ type: GoalDto })
  @ApiNotFoundResponse({ type: ErrorResponse })
  removeContribution(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
  ): Promise<GoalDto> {
    return this.goals.removeContribution(user.id, id, contributionId);
  }
}
