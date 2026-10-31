import type { NormalizedTxn } from '@et/domain';
import type { DedupCandidate, DedupMatch, DedupRule } from '../pipeline';
import { istDaysApart, otherKind, sameMoney } from './match';

export const POSSIBLE_DUPLICATE_DAYS = 3;

/** Rule 4: same amount and direction within ±3 days. Never merges; the user decides. */
export class PossibleDuplicateRule implements DedupRule {
  readonly name = 'possible-duplicate';

  find(txn: NormalizedTxn, candidates: DedupCandidate[]): DedupMatch | null {
    const hit = candidates.find((c) => sameMoney(txn, c) && otherKind(txn, c) && istDaysApart(txn, c) <= POSSIBLE_DUPLICATE_DAYS);
    return hit ? { transactionId: hit.id, action: 'flag', rule: this.name } : null;
  }
}
