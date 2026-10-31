import type { CategorizerRule } from '../categorizer-rule';
import { GlobalMerchantRule } from './global-merchant.rule';
import { KeywordRule } from './keyword.rule';
import { UserMerchantRule } from './user-merchant.rule';

/**
 * Order matters: first match wins. The user's pick (manual entry) runs before these in ingest,
 * and the Income / Other fallback after them.
 */
export const CATEGORIZER_RULES: readonly CategorizerRule[] = [new UserMerchantRule(), new GlobalMerchantRule(), new KeywordRule()];
