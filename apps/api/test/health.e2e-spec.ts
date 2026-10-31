import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { PrismaService } from '../src/common';

async function boot(prismaOverride?: Partial<PrismaService>): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (prismaOverride) builder.overrideProvider(PrismaService).useValue(prismaOverride);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

describe('GET /v1/health', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('returns ok when the database answers', async () => {
    app = await boot();
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(typeof res.body.version).toBe('string');
  });

  it('returns 503 in the error shape when the database is down', async () => {
    app = await boot({
      $queryRaw: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      $disconnect: jest.fn(),
    } as unknown as Partial<PrismaService>);
    const res = await request(app.getHttpServer()).get('/v1/health').expect(503);
    expect(res.body).toEqual({ error: { code: 'DB_UNAVAILABLE', message: 'Database is not reachable' } });
  });

  it('answers unknown routes with 404 in the error shape', async () => {
    app = await boot();
    const res = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
