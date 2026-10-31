import { SYSTEM_CATEGORIES, type Direction } from '@et/domain';
import type { CategorizeInput, CategorizerRule, CategoryMatch } from '../categorizer-rule';
import { containsWords, padded } from './word-match';

interface KeywordEntry {
  category: string;
  /** Only for this direction; salary is never a debit, rent is never a credit. */
  direction: Direction;
  words: string[];
}

/**
 * Words that say what a payment is when the merchant is unknown. Transfers to a person
 * ("NEFT/IMPS to <name>") need statement narrations and arrive with statement import.
 */
export const KEYWORDS: readonly KeywordEntry[] = [
  { category: 'income', direction: 'credit', words: ['SALARY', 'SAL CR', 'SAL', 'PAYROLL', 'INTEREST', 'INT CR', 'INT PD', 'DIVIDEND'] },
  { category: 'rent', direction: 'debit', words: ['RENT', 'HOUSE RENT', 'PG RENT'] },
  { category: 'bills_utilities', direction: 'debit', words: ['INSURANCE', 'PREMIUM', 'LIC', 'MAINTENANCE'] },
  { category: 'education', direction: 'debit', words: ['SCHOOL FEE', 'SCHOOL FEES', 'TUITION FEE', 'COLLEGE FEE'] },
];

/** Keyword rules on merchant name and narration, after the merchant lists. */
export class KeywordRule implements CategorizerRule {
  readonly name = 'keyword';
  private readonly entries: { categoryId: string; direction: Direction; words: string[] }[];

  constructor(keywords: readonly KeywordEntry[] = KEYWORDS) {
    const idByKey = new Map(SYSTEM_CATEGORIES.map((c) => [c.key, c.id]));
    this.entries = keywords.map((k) => {
      const categoryId = idByKey.get(k.category);
      if (!categoryId) throw new Error(`Unknown system category "${k.category}" in keyword rules`);
      return { categoryId, direction: k.direction, words: k.words };
    });
  }

  apply(input: CategorizeInput): CategoryMatch | null {
    const merchant = input.merchantKey ? ` ${input.merchantKey} ` : null;
    const narration = padded(input.narration);
    const hit = this.entries.find(
      (e) => e.direction === input.direction && e.words.some((w) => containsWords(w, merchant, narration)),
    );
    return hit ? { categoryId: hit.categoryId, rule: this.name } : null;
  }
}
