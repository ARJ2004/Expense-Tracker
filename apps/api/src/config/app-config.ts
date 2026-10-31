import { plainToInstance, Transform, Type } from 'class-transformer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version: string };
  return pkg.version;
}

/** Environment the API needs; checked once at boot so a bad deploy fails fast. */
export class AppConfig {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  APP_VERSION = readPackageVersion();

  /** OAuth Web client ID; Google ID tokens must carry it as their audience. Required in production. */
  @IsOptional()
  @IsString()
  GOOGLE_WEB_CLIENT_ID?: string;

  /** HS256 secret for access tokens; at least 32 random bytes. */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  ACCESS_TOKEN_TTL_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS = 30;

  /**
   * Accepts "dev:<email>" as an ID token so the app can be used before Google OAuth clients exist.
   * Never allowed in production (checked in validateConfig).
   */
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  DEV_AUTH_ENABLED = false;
}

export function validateConfig(raw: Record<string, unknown>): AppConfig {
  const config = plainToInstance(AppConfig, raw, { enableImplicitConversion: true });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment:\n  ${details.join('\n  ')}`);
  }
  if (config.NODE_ENV === 'production') {
    if (config.DEV_AUTH_ENABLED) throw new Error('Invalid environment: DEV_AUTH_ENABLED must be false in production');
    if (!config.GOOGLE_WEB_CLIENT_ID) throw new Error('Invalid environment: GOOGLE_WEB_CLIENT_ID is required in production');
  }
  return config;
}
