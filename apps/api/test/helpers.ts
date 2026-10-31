import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { ID_TOKEN_VERIFIERS, type IdTokenVerifier } from '../src/auth';
import { PrismaService } from '../src/common';

export interface BootOptions {
  prisma?: Partial<PrismaService>;
  verifiers?: IdTokenVerifier[];
}

/** A fresh app per test, so per-route rate limits start from zero. */
export async function boot(options: BootOptions = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.prisma) builder.overrideProvider(PrismaService).useValue(options.prisma);
  if (options.verifiers) builder.overrideProvider(ID_TOKEN_VERIFIERS).useValue(options.verifiers);
  const app = configureApp((await builder.compile()).createNestApplication());
  await app.init();
  return app;
}

/** Removes every user and, by cascade, their rows. System categories (user_id null) stay. */
export async function resetDb(app: INestApplication): Promise<void> {
  await app.get(PrismaService).$executeRawUnsafe('DELETE FROM users');
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; onboarded: boolean };
}

/** Signs in through the dev verifier ("dev:<email>"). */
export async function signIn(app: INestApplication, email: string, deviceId = 'device-0001'): Promise<Session> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/google')
    .send({ idToken: `dev:${email}`, deviceId })
    .expect(200);
  return res.body as Session;
}

export const bearer = (s: Session) => ({ Authorization: `Bearer ${s.accessToken}` });
