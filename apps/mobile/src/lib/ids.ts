/** Polyfilled by react-native-get-random-values (imported first in index.js). */
declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T };

/** A random RFC 4122 v4 UUID, e.g. the clientRequestId that makes a create idempotent. */
export function newUuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  /* eslint-disable no-bitwise -- setting the UUID version (4) and variant bits */
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  /* eslint-enable no-bitwise */
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
