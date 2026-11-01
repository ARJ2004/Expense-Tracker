import type { NormalizedTxn } from '@et/domain';
import type { DedupCandidate, DedupMatch, DedupRule } from '../pipeline';
import { istDaysApart, otherKind, sameMoney } from './match';

/** Rule 4: same amount and direction within ±N days (3 by default). Never merges; the user decides. */
export class PossibleDuplicateRule implements DedupRule {
  readonly name = 'possible-duplicate';

  /** @param days IST days apart still flagged (tunables.dedup.possibleDuplicateDays). */
  constructor(private readonly days: number) {}

  find(txn: NormalizedTxn, candidates: DedupCandidate[]): DedupMatch | null {
    const hit = candidates.find((c) => sameMoney(txn, c) && otherKind(txn, c) && istDaysApart(txn, c) <= this.days);
    return hit ? { transactionId: hit.id, action: 'flag', rule: this.name } : null;
  }
}
