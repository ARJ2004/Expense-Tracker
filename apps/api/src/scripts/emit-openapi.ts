import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApi, createApp } from '../app.factory';

/** Writes the OpenAPI spec that packages/api-client is generated from. Needs no database. */
async function emit(): Promise<void> {
  process.env.DATABASE_URL ??= 'postgresql://unused@localhost/unused';
  process.env.JWT_ACCESS_SECRET ??= 'openapi-emit-only-'.padEnd(32, 'x');
  const app = await createApp();
  const target = resolve(__dirname, '../../../../packages/api-client/openapi.json');
  writeFileSync(target, `${JSON.stringify(buildOpenApi(app), null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI written to ${target}`);
}

void emit();
