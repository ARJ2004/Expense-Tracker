import type { NormalizedTxn } from '@et/domain';
import type { DedupCandidate, DedupMatch, DedupRule } from '../pipeline';
import { sameMoney } from './match';

/** Rule 1: the same bank reference (UPI RRN, NEFT UTR) and amount is the same payment. */
export class ReferenceRule implements DedupRule {
  readonly name = 'reference';

  find(txn: NormalizedTxn, candidates: DedupCandidate[]): DedupMatch | null {
    const ref = txn.referenceNo?.trim().toUpperCase();
    if (!ref) return null;
    const hit = candidates.find((c) => c.referenceNo?.trim().toUpperCase() === ref && sameMoney(txn, c));
    return hit ? { transactionId: hit.id, action: 'merge', rule: this.name } : null;
  }
}
