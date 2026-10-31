import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { paise, type Direction } from '@et/domain';
import { AppModule } from '../app.module';
import { PrismaService } from '../common';
import { IngestService } from '../ingest';

/**
 * Fills a dev user's ledger with realistic rows through IngestService (never raw inserts), so
 * categorization runs on every one. Re-running adds nothing: each row's request id is fixed.
 *
 *   pnpm --filter @et/api seed:demo -- --email dev@altus.local --rows 200
 *
 * Refuses to run when NODE_ENV is production.
 */
const MERCHANTS: { name: string; min: number; max: number; direction?: Direction }[] = [
  { name: 'Swiggy', min: 180, max: 900 },
  { name: 'Zomato', min: 150, max: 800 },
  { name: 'Blinkit', min: 120, max: 1500 },
  { name: 'BigBasket', min: 400, max: 3200 },
  { name: 'Uber', min: 90, max: 650 },
  { name: 'Rapido', min: 40, max: 220 },
  { name: 'Amazon', min: 250, max: 4500 },
  { name: 'Myntra', min: 600, max: 3500 },
  { name: 'Airtel Postpaid', min: 499, max: 999 },
  { name: 'BESCOM', min: 800, max: 2600 },
  { name: 'Netflix', min: 649, max: 649 },
  { name: 'Apollo Pharmacy', min: 120, max: 1400 },
  { name: 'Indian Oil', min: 500, max: 3000 },
  { name: 'IRCTC', min: 450, max: 2800 },
  { name: 'Sharma General Store', min: 60, max: 700 },
  { name: 'Chai Point', min: 40, max: 260 },
];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

/** Deterministic pseudo-random in [0, 1) from a seed, so the same rows come back each run. */
function rand(seed: string): number {
  return createHash('sha256').update(seed).digest().readUInt32BE(0) / 2 ** 32;
}

function uuidFrom(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('seed:demo never runs in production');
  const email = arg('email', 'dev@altus.local');
  const rows = Number(arg('rows', '200'));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const ingest = app.get(IngestService);
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}; sign in once in the app first`);
  const account = await prisma.account.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });

  const now = Date.now();
  let created = 0;
  for (let i = 0; i < rows; i++) {
    const key = `${user.id}|demo|${i}`;
    // Monthly salary on the 1st, everything else spread over the last 90 days.
    const salary = i % 40 === 0;
    const m = MERCHANTS[Math.floor(rand(`${key}|m`) * MERCHANTS.length)]!;
    const rupees = salary ? 75_000 : Math.round(m.min + rand(`${key}|a`) * (m.max - m.min));
    const occurredAt = new Date(now - Math.floor(rand(`${key}|t`) * 90 * 86_400_000));
    const result = await ingest.ingest(
      user.id,
      {
        source: 'manual',
        amountPaise: paise(rupees * 100),
        direction: salary ? 'credit' : (m.direction ?? 'debit'),
        occurredAt,
        timePrecision: 'minute',
        accountId: account?.id,
        counterparty: salary ? 'Acme Corp salary' : m.name,
      },
      { kind: 'manual', clientRequestId: uuidFrom(key) },
    );
    if (result.created) created++;
  }
  console.log(`Seeded ${created} new transactions for ${email} (${rows - created} already there)`);
  await app.close();
}

void seed();
