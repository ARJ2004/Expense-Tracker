import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppError, ErrorResponse, PrismaService } from '../common';
import { HealthResponse } from './health.dto';

const DB_TIMEOUT_MS = 1000;

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness and database check' })
  @ApiOkResponse({ type: HealthResponse })
  @ApiServiceUnavailableResponse({ type: ErrorResponse })
  async check(): Promise<HealthResponse> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS)),
      ]);
    } catch {
      throw new AppError('DB_UNAVAILABLE', 'Database is not reachable', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return {
      status: 'ok',
      db: 'ok',
      version: this.config.getOrThrow<string>('APP_VERSION'),
      time: new Date().toISOString(),
    };
  }
}
