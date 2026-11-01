/**
 * Numbers the API's behaviour depends on (dedup windows, rate limits), in one place instead of
 * spread through the code. Each has a default and can be overridden from the environment; a bad
 * value fails at boot. Plain constants rather than ConfigService, because @Throttle decorators are
 * evaluated before dependency injection exists.
 */
export interface RateLimit {
  limit: number;
  /** Window in milliseconds. */
  ttl: number;
}

export interface Tunables {
  dedup: {
    /** Rule 3: minimum trigram similarity between counterparty and merchant name to merge. */
    minCounterpartySimilarity: number;
    /** Rule 4: same amount within this many IST days is flagged as a possible duplicate. */
    possibleDuplicateDays: number;
  };
  rateLimits: {
    /** Every route, per client IP. */
    default: RateLimit;
    /** Sign-in and token refresh. */
    auth: RateLimit;
    /** POST /v1/ingest/batch: a first 90-day SMS sync is a handful of batches. */
    ingestBatch: RateLimit;
    /** Statement uploads. */
    upload: RateLimit;
    /** PDF password attempts. */
    unlock: RateLimit;
  };
}

const MINUTE = 60_000;

function int(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) throw new Error(`Invalid environment: ${name} must be an integer ≥ ${min}`);
  return value;
}

function ratio(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error(`Invalid environment: ${name} must be a number in (0, 1]`);
  return value;
}

const perMinute = (env: NodeJS.ProcessEnv, name: string, fallback: number): RateLimit => ({ limit: int(env, name, fallback, 1), ttl: MINUTE });

export function loadTunables(env: NodeJS.ProcessEnv = process.env): Tunables {
  return {
    dedup: {
      minCounterpartySimilarity: ratio(env, 'DEDUP_MIN_COUNTERPARTY_SIMILARITY', 0.6),
      possibleDuplicateDays: int(env, 'DEDUP_POSSIBLE_DUPLICATE_DAYS', 3, 0),
    },
    rateLimits: {
      default: perMinute(env, 'RATE_LIMIT_PER_MINUTE', 300),
      auth: perMinute(env, 'RATE_LIMIT_AUTH_PER_MINUTE', 10),
      ingestBatch: perMinute(env, 'RATE_LIMIT_INGEST_BATCH_PER_MINUTE', 60),
      upload: perMinute(env, 'RATE_LIMIT_UPLOAD_PER_MINUTE', 5),
      unlock: perMinute(env, 'RATE_LIMIT_UNLOCK_PER_MINUTE', 10),
    },
  };
}

/** Loaded once when the API starts. */
export const tunables = loadTunables();
