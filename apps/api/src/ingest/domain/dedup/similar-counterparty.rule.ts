import type { NormalizedTxn } from '@et/domain';
import type { DedupCandidate, DedupMatch, DedupRule } from '../pipeline';
import { otherKind, sameIstDay, sameMoney } from './match';
import { trigramSimilarity } from './trigram';

/** Rule 3: same amount, direction and day, account unknown on one side, and a similar merchant. */
export class SimilarCounterpartyRule implements DedupRule {
  readonly name = 'similar-counterparty';

  /** @param minSimilarity trigram similarity needed to merge (tunables.dedup.minCounterpartySimilarity). */
  constructor(private readonly minSimilarity: number) {}

  find(txn: NormalizedTxn, candidates: DedupCandidate[]): DedupMatch | null {
    if (!txn.counterparty) return null;
    const hit = candidates.find(
      (c) =>
        (!txn.accountId || !c.accountId) &&
        c.merchantName !== null &&
        sameMoney(txn, c) &&
        sameIstDay(txn, c) &&
        otherKind(txn, c) &&
        trigramSimilarity(txn.counterparty!, c.merchantName) >= this.minSimilarity,
    );
    return hit ? { transactionId: hit.id, action: 'merge', rule: this.name } : null;
  }
}
