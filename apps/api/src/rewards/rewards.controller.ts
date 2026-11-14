import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, ErrorResponse, type AuthUser } from '../common';
import { RewardsDto } from './dto/rewards.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  @ApiOperation({ operationId: 'getRewards', summary: 'The under-budget streak, the last 14 closed days and every badge' })
  @ApiOkResponse({ type: RewardsDto })
  summary(@CurrentUser() user: AuthUser): Promise<RewardsDto> {
    return this.rewards.summary(user.id);
  }
}
