import { PossibleDuplicateRule, ReferenceRule, SameAccountDayRule, SimilarCounterpartyRule } from '../dedup';
import type { CategoryRule, DedupRule, TypeRule } from '../pipeline';
import { AtmRule } from './atm.rule';
import { CashDepositRule } from './cash-deposit.rule';
import { DefaultCategoryRule } from './default-category.rule';
import { DirectionTypeRule } from './direction-type.rule';
import { OwnAccountTransferRule } from './own-account-transfer.rule';
import { RefundRule } from './refund.rule';
import { UserChoiceRule } from './user-choice.rule';
import { tunables, type Tunables } from '../../../config/tunables';

/**
 * Category steps inside ingest, in order: the user's pick (CATEGORY_RULES), then the categories
 * module's CategorizerService (user merchant rules → global merchants → keywords), then
 * FALLBACK_CATEGORY (Income for credits, Other for debits).
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [new UserChoiceRule()];
export const FALLBACK_CATEGORY = new DefaultCategoryRule();

/** Specific types first; the direction fallback (expense / income) always matches, so it goes last. */
export const TYPE_RULES: readonly TypeRule[] = [
  new AtmRule(),
  new CashDepositRule(),
  new OwnAccountTransferRule(),
  new RefundRule(),
  new DirectionTypeRule(),
];

/**
 * Dedup rules 1–4 from the design doc, in order; the first match wins. They run for automatic
 * sources (statement rows and bank SMS). A manual entry is the user's own word and is never
 * merged on the way in; a later statement row merges into it instead.
 */
export function dedupRules(t: Tunables['dedup']): readonly DedupRule[] {
  return [new ReferenceRule(), new SameAccountDayRule(), new SimilarCounterpartyRule(t.minCounterpartySimilarity), new PossibleDuplicateRule(t.possibleDuplicateDays)];
}

/** The rules with this API's tunables (config/tunables.ts). */
export const DEDUP_RULES: readonly DedupRule[] = dedupRules(tunables.dedup);
