import { istDateKey, type NormalizedTxn } from '@et/domain';
import type { DedupCandidate } from '../pipeline';

const DAY_MS = 86_400_000;

export function sameMoney(txn: NormalizedTxn, c: DedupCandidate): boolean {
  return c.amountPaise === txn.amountPaise && c.direction === txn.direction;
}

/** Same calendar day in IST (statement rows carry a day, not a time). */
export function sameIstDay(txn: NormalizedTxn, c: DedupCandidate): boolean {
  return istDateKey(txn.occurredAt) === istDateKey(c.occurredAt);
}

/** Whole IST days between the two, ignoring time of day. */
export function istDaysApart(txn: NormalizedTxn, c: DedupCandidate): number {
  const a = Date.parse(istDateKey(txn.occurredAt));
  const b = Date.parse(istDateKey(c.occurredAt));
  return Math.abs(a - b) / DAY_MS;
}

/**
 * The same-kind guard: two sightings from the same kind of source (two statement rows, two SMS)
 * are two payments, never one, so rules 2–4 skip candidates already seen from this kind.
 */
export function otherKind(txn: NormalizedTxn, c: DedupCandidate): boolean {
  return !c.sourceKinds.includes(txn.source);
}
