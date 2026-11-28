import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common';
import { boot } from './helpers';

describe('POST /v1/waitlist', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await boot();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('DELETE FROM waitlist_entries');
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: object, ip = '203.0.113.10') =>
    request(app.getHttpServer()).post('/v1/waitlist').set('X-Forwarded-For', ip).send(body);

  it('adds an address once, lower-cased, and answers the same for a repeat', async () => {
    await post({ email: '  Riya@Example.com ', source: 'download' }).expect(202, { status: 'ok' });
    await post({ email: 'riya@example.com' }).expect(202, { status: 'ok' });
    const rows = await prisma.waitlistEntry.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'riya@example.com', platform: 'ios', source: 'download' });
  });

  it('rejects a bad address in the error shape', async () => {
    const res = await post({ email: 'not-an-email' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(await prisma.waitlistEntry.count()).toBe(0);
  });

  it('accepts a honeypot hit without storing it', async () => {
    await post({ email: 'bot@example.com', website: 'https://spam.example' }).expect(202);
    expect(await prisma.waitlistEntry.count()).toBe(0);
  });

  it('sends a plain HTML form post back to the Download page', async () => {
    await request(app.getHttpServer())
      .post('/v1/waitlist')
      .set('Accept', 'text/html')
      .type('form')
      .send({ email: 'kabir@example.com', source: 'download', website: '' })
      .expect(303)
      .expect('Location', '/download?waitlist=ok#iphone');
    expect(await prisma.waitlistEntry.count()).toBe(1);
  });

  it('rate-limits per visitor IP, not for everyone behind the proxy', async () => {
    for (let i = 0; i < 5; i++) await post({ email: `a${i}@example.com` }, '198.51.100.1').expect(202);
    await post({ email: 'a5@example.com' }, '198.51.100.1').expect(429);
    await post({ email: 'b@example.com' }, '198.51.100.2').expect(202);
  });
});
