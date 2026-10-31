import { createHash } from 'node:crypto';

/**
 * Where a NormalizedTxn came from, with what makes it idempotent. Each source adds a variant
 * (statement rows and SMS arrive in later sprints with their own hash inputs).
 */
export type SourceInput = { kind: 'manual'; clientRequestId: string };

/** SHA-256 of the normalized raw input; re-sending the same input is a no-op. */
export function sourceHash(userId: string, input: SourceInput): string {
  const material = `manual|${userId}|${input.clientRequestId.toLowerCase()}`;
  return createHash('sha256').update(material).digest('hex');
}
