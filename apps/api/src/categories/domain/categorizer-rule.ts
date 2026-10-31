import type { Direction } from '@et/domain';

/** What the categorizer looks at. Keys are merchantKey() form (upper case, single spaces). */
export interface CategorizeInput {
  merchantKey: string | null;
  /** Statement narration or SMS text, when the source has one; matched in merchantKey() form too. */
  narration?: string | null;
  direction: Direction;
}

/** Facts a rule needs that come from the database, loaded once before the rules run. */
export interface CategorizeContext {
  /** The user's own rule for this merchant, if they saved one. */
  userRuleCategoryId: string | null;
}

export interface CategoryMatch {
  categoryId: string;
  /** Name of the rule that matched, for logs and tests. */
  rule: string;
}

/** One categorization strategy. CATEGORIZER_RULES run in order; the first match wins. */
export interface CategorizerRule {
  readonly name: string;
  apply(input: CategorizeInput, ctx: CategorizeContext): CategoryMatch | null;
}
