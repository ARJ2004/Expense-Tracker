import { splitEqually, validateExactSplit, type GroupSplitMode, type Share } from '@et/domain';

/** What a split strategy gets: the amount, the group's member ids in member order, and the request. */
export interface SplitInput {
  amountPaise: number;
  memberOrder: readonly string[];
  memberIds?: readonly string[];
  shares?: readonly Share[];
}

export type SplitResult = { ok: true; shares: Share[] } | { ok: false; code: string; message: string };

/** One way of sharing an expense. Adding a mode (percent, shares) = one class in SPLIT_STRATEGIES. */
export interface SplitStrategy {
  readonly mode: GroupSplitMode;
  compute(input: SplitInput): SplitResult;
}

const unknownMember = (ids: readonly string[], order: readonly string[]): boolean => ids.some((id) => !order.includes(id));
const hasDuplicates = (ids: readonly string[]): boolean => new Set(ids).size !== ids.length;
const fail = (code: string, message: string): SplitResult => ({ ok: false, code, message });

export class EqualSplit implements SplitStrategy {
  readonly mode = 'equal' as const;

  compute({ amountPaise, memberOrder, memberIds }: SplitInput): SplitResult {
    if (!memberIds?.length) return fail('VALIDATION_FAILED', 'Pick who shares this expense');
    if (hasDuplicates(memberIds)) return fail('VALIDATION_FAILED', 'A member is listed twice');
    if (unknownMember(memberIds, memberOrder)) return fail('GROUP_UNKNOWN_MEMBER', 'That member is not in this group');
    // Member order, not request order, decides who gets the leftover paise.
    return { ok: true, shares: splitEqually(amountPaise, memberOrder.filter((id) => memberIds.includes(id))) };
  }
}

export class ExactSplit implements SplitStrategy {
  readonly mode = 'exact' as const;

  compute({ amountPaise, memberOrder, shares }: SplitInput): SplitResult {
    if (!shares?.length) return fail('VALIDATION_FAILED', "Enter each member's amount");
    const ids = shares.map((s) => s.memberId);
    if (hasDuplicates(ids)) return fail('VALIDATION_FAILED', 'A member is listed twice');
    if (unknownMember(ids, memberOrder)) return fail('GROUP_UNKNOWN_MEMBER', 'That member is not in this group');
    const check = validateExactSplit(amountPaise, shares);
    if (!check.ok) return fail('GROUP_SPLIT_MISMATCH', 'The amounts must add up to the total');
    // A 0 share means not sharing; keep the rest in member order.
    return { ok: true, shares: memberOrder.flatMap((id) => shares.filter((s) => s.memberId === id && s.sharePaise > 0)) };
  }
}

export const SPLIT_STRATEGIES: readonly SplitStrategy[] = [new EqualSplit(), new ExactSplit()];
