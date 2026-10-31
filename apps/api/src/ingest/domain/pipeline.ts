import type { CategorySource, NormalizedTxn, TxnType } from '@et/domain';

export interface CategoryHit {
  categoryId: string;
  source: CategorySource;
}

/** One categorization strategy. Rules run in list order; the first hit wins. */
export interface CategoryRule {
  readonly name: string;
  apply(txn: NormalizedTxn): CategoryHit | null;
}

/** What type rules may know beyond the row itself. */
export interface TypeContext {
  /** Last 4 digits of the user's other accounts, for own-account transfers. */
  ownAccountLast4: readonly string[];
}

/** One type classification strategy (transfer, ATM, refund, ...). First non-null wins. */
export interface TypeRule {
  readonly name: string;
  classify(txn: NormalizedTxn, ctx?: TypeContext): TxnType | null;
}

/** An existing ledger row a new sighting might be the same payment as. */
export interface DedupCandidate {
  id: string;
  amountPaise: number;
  direction: NormalizedTxn['direction'];
  occurredAt: Date;
  accountId: string | null;
  referenceNo: string | null;
  merchantName: string | null;
  sourceKinds: NormalizedTxn['source'][];
}

export interface DedupMatch {
  transactionId: string;
  /** "merge" attaches the source; "flag" keeps both and marks a possible duplicate. */
  action: 'merge' | 'flag';
  /** Which rule matched (or "source" when this exact row was imported before). */
  rule: string;
}

/** One dedup rule from the design doc's table; evaluated in order. */
export interface DedupRule {
  readonly name: string;
  find(txn: NormalizedTxn, candidates: DedupCandidate[]): DedupMatch | null;
}

/** Runs strategies in order and returns the first non-null result. */
export function firstMatch<R, T>(rules: readonly R[], run: (rule: R) => T | null): T | null {
  for (const rule of rules) {
    const result = run(rule);
    if (result !== null) return result;
  }
  return null;
}
