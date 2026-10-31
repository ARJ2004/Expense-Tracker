import type { CategorizeContext, CategorizeInput, CategorizerRule, CategoryMatch } from '../categorizer-rule';

/** The user's own "apply to all from this merchant" rule beats every built-in rule. */
export class UserMerchantRule implements CategorizerRule {
  readonly name = 'user-merchant';

  apply(_input: CategorizeInput, ctx: CategorizeContext): CategoryMatch | null {
    return ctx.userRuleCategoryId ? { categoryId: ctx.userRuleCategoryId, rule: this.name } : null;
  }
}
