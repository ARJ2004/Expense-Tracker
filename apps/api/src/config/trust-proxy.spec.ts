import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('defaults to trusting only loopback (Nginx on the same box)', () => {
    expect(parseTrustProxy(undefined)).toBe('loopback');
    expect(parseTrustProxy('  ')).toBe('loopback');
  });

  it('reads a hop count, booleans and address lists', () => {
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
