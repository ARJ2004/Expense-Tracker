import { SYSTEM_CATEGORIES } from '@et/domain';
import type { CategorizeInput, CategorizerRule, CategoryMatch } from '../categorizer-rule';
import { MERCHANT_RULES, type MerchantRuleEntry } from '../merchant-rules';
import { containsWords, padded } from './word-match';

/** Narration is noisy ("UPI/VI/…"); patterns shorter than this only match the merchant name. */
const MIN_NARRATION_PATTERN = 4;

interface CompiledPattern {
  pattern: string;
  categoryId: string;
}

/**
 * Flattens the rule list into match order: every brand before any generic word, and longest
 * first within each group, so "AMAZON PRIME" wins over "AMAZON" and "FASTAG" over "RECHARGE".
 */
export function compile(rules: readonly MerchantRuleEntry[]): CompiledPattern[] {
  const idByKey = new Map(SYSTEM_CATEGORIES.map((c) => [c.key, c.id]));
  const brands: CompiledPattern[] = [];
  const generic: CompiledPattern[] = [];
  for (const rule of rules) {
    const categoryId = idByKey.get(rule.category);
    if (!categoryId) throw new Error(`Unknown system category "${rule.category}" in merchant rules`);
    for (const pattern of rule.patterns) brands.push({ pattern, categoryId });
    for (const pattern of rule.generic ?? []) generic.push({ pattern, categoryId });
  }
  const longestFirst = (a: CompiledPattern, b: CompiledPattern) => b.pattern.length - a.pattern.length;
  return [...brands.sort(longestFirst), ...generic.sort(longestFirst)];
}

/** The seeded Indian merchant list (merchant-rules.ts), matched on merchant name, then narration. */
export class GlobalMerchantRule implements CategorizerRule {
  readonly name = 'global-merchant';
  private readonly patterns: CompiledPattern[];

  constructor(rules: readonly MerchantRuleEntry[] = MERCHANT_RULES) {
    this.patterns = compile(rules);
  }

  apply(input: CategorizeInput): CategoryMatch | null {
    const merchant = input.merchantKey ? ` ${input.merchantKey} ` : null;
    const narration = padded(input.narration);
    if (!merchant && !narration) return null;
    // Merchant name first: it is cleaner than narration text.
    const hit =
      this.patterns.find((p) => containsWords(p.pattern, merchant)) ??
      this.patterns.find((p) => p.pattern.length >= MIN_NARRATION_PATTERN && containsWords(p.pattern, narration));
    return hit ? { categoryId: hit.categoryId, rule: this.name } : null;
  }
}
