import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common';
import type { CategorizeInput, CategoryMatch } from './domain/categorizer-rule';
import { CATEGORIZER_RULES } from './domain/rules';

type Db = Prisma.TransactionClient;

export interface CorrectionLog {
  merchantKey: string | null;
  fromCategoryId: string | null;
  toCategoryId: string;
  appliedToAll: boolean;
}

/**
 * Picks a category from the rules (user merchant rules → global merchant list → keywords) and
 * owns what corrections write: merchant_rules and category_corrections. Returns null when no
 * rule matched; the caller then uses the Income / Other fallback.
 */
@Injectable()
export class CategorizerService {
  constructor(private readonly prisma: PrismaService) {}

  async categorize(userId: string, input: CategorizeInput, db: Db = this.prisma): Promise<CategoryMatch | null> {
    const own = input.merchantKey
      ? await db.merchantRule.findUnique({ where: { userId_patternKey: { userId, patternKey: input.merchantKey } } })
      : null;
    const ctx = { userRuleCategoryId: own?.categoryId ?? null };
    for (const rule of CATEGORIZER_RULES) {
      const match = rule.apply(input, ctx);
      if (match) return match;
    }
    return null;
  }

  /** "Apply to all from this merchant": future rows from it get this category. */
  async saveMerchantRule(userId: string, key: string, merchantName: string, categoryId: string, db: Db = this.prisma): Promise<void> {
    await db.merchantRule.upsert({
      where: { userId_patternKey: { userId, patternKey: key } },
      create: { userId, patternKey: key, merchantName, categoryId },
      update: { merchantName, categoryId },
    });
  }

  async logCorrection(userId: string, log: CorrectionLog, db: Db = this.prisma): Promise<void> {
    await db.categoryCorrection.create({ data: { userId, ...log } });
  }
}
