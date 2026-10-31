import type { CategoryRule, DedupRule, TypeRule } from '../pipeline';
import { DefaultCategoryRule } from './default-category.rule';
import { DirectionTypeRule } from './direction-type.rule';
import { UserChoiceRule } from './user-choice.rule';

/**
 * Category steps inside ingest, in order: the user's pick (CATEGORY_RULES), then the categories
 * module's CategorizerService (user merchant rules → global merchants → keywords), then
 * FALLBACK_CATEGORY (Income for credits, Other for debits).
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [new UserChoiceRule()];
export const FALLBACK_CATEGORY = new DefaultCategoryRule();

/** Transfer, ATM and refund rules (Sprint 5) slot in before the direction fallback. */
export const TYPE_RULES: readonly TypeRule[] = [new DirectionTypeRule()];

/**
 * Dedup rules 1–4 from the design doc arrive with statement import (Sprint 5). Manual entries only
 * meet other manual entries, and two sources of the same kind never merge, so none apply yet.
 */
export const DEDUP_RULES: readonly DedupRule[] = [];
