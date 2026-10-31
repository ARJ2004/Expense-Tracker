import { plainToInstance, Type } from 'class-transformer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IsIn, IsInt, IsString, Max, Min, validateSync } from 'class-validator';

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
}

export function validateConfig(raw: Record<string, unknown>): AppConfig {
  const config = plainToInstance(AppConfig, raw, { enableImplicitConversion: true });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment:\n  ${details.join('\n  ')}`);
  }
  return config;
}
