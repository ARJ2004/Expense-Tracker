import type { NormalizedTxn } from '@et/domain';
import type { DedupCandidate, DedupMatch, DedupRule } from '../pipeline';
import { otherKind, sameIstDay, sameMoney } from './match';

/**
 * Rule 2: same account, amount and direction on the same IST day. The design doc says ±2 minutes;
 * statement rows have no time of day, so the day is the window.
 */
export class SameAccountDayRule implements DedupRule {
  readonly name = 'same-account-day';

  find(txn: NormalizedTxn, candidates: DedupCandidate[]): DedupMatch | null {
    if (!txn.accountId) return null;
    const hit = candidates.find((c) => c.accountId === txn.accountId && sameMoney(txn, c) && sameIstDay(txn, c) && otherKind(txn, c));
    return hit ? { transactionId: hit.id, action: 'merge', rule: this.name } : null;
  }
}
