import { loadTunables } from './tunables';

describe('loadTunables', () => {
  it('uses the design doc defaults', () => {
    const t = loadTunables({});
    expect(t.dedup).toEqual({ minCounterpartySimilarity: 0.6, possibleDuplicateDays: 3 });
    expect(t.rateLimits.auth).toEqual({ limit: 10, ttl: 60_000 });
    expect(t.rateLimits.default.limit).toBe(300);
  });

  it('takes overrides from the environment', () => {
    const t = loadTunables({ DEDUP_POSSIBLE_DUPLICATE_DAYS: '5', RATE_LIMIT_AUTH_PER_MINUTE: '30', DEDUP_MIN_COUNTERPARTY_SIMILARITY: '0.75' });
    expect(t.dedup).toEqual({ minCounterpartySimilarity: 0.75, possibleDuplicateDays: 5 });
    expect(t.rateLimits.auth.limit).toBe(30);
  });

  it('fails at boot on a bad value', () => {
    expect(() => loadTunables({ RATE_LIMIT_AUTH_PER_MINUTE: '0' })).toThrow('RATE_LIMIT_AUTH_PER_MINUTE');
    expect(() => loadTunables({ DEDUP_MIN_COUNTERPARTY_SIMILARITY: '2' })).toThrow('DEDUP_MIN_COUNTERPARTY_SIMILARITY');
    expect(() => loadTunables({ DEDUP_POSSIBLE_DUPLICATE_DAYS: 'three' })).toThrow('DEDUP_POSSIBLE_DUPLICATE_DAYS');
  });
});
