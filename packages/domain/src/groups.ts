/**
 * Groups and shared expenses: members are names, an expense has one payer and is shared by some
 * members, and payments settle debts between members. Balances and "who pays whom" are worked
 * out from those rows on every read, here, so the API and the app always agree. Amounts are
 * integer paise; days are IST calendar days ("YYYY-MM-DD").
 */

export const GROUP_LIMITS = {
  nameLength: { min: 1, max: 40 },
  memberNameLength: { min: 1, max: 30 },
  descriptionLength: { min: 1, max: 60 },
  maxActiveGroups: 50,
  maxMembers: 50,
  /** ₹1 crore per expense or payment. */
  maxAmountPaise: 1_000_000_000,
} as const;

export const GROUP_SPLIT_MODES = ['equal', 'exact'] as const;
export type GroupSplitMode = (typeof GROUP_SPLIT_MODES)[number];

export interface Share {
  memberId: string;
  sharePaise: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amountPaise: number;
}

export interface BalanceExpense {
  paidById: string;
  amountPaise: number;
  shares: readonly Share[];
}

export interface BalancePayment {
  fromId: string;
  toId: string;
  amountPaise: number;
}

/** What makes two member names the same: case and extra spaces don't count. */
export function memberNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Splits an amount equally between members, in paise. The paise left over after dividing go one
 * each to the first members in the order given (the group's member order), so the shares always
 * add up exactly: ₹100 between three is 3334 + 3333 + 3333.
 */
export function splitEqually(amountPaise: number, memberIds: readonly string[]): Share[] {
  if (memberIds.length === 0) throw new RangeError('At least one member shares an expense');
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) throw new RangeError(`Not an amount in paise: ${amountPaise}`);
  const base = Math.floor(amountPaise / memberIds.length);
  const extra = amountPaise - base * memberIds.length;
  return memberIds.map((memberId, i) => ({ memberId, sharePaise: base + (i < extra ? 1 : 0) }));
}

export type ExactSplitCheck = { ok: true } | { ok: false; diffPaise: number };

/**
 * Whether exact shares add up to the amount. `diffPaise` is what is still to be shared (positive,
 * "₹120 left") or shared too much (negative, "₹15 over").
 */
export function validateExactSplit(amountPaise: number, shares: readonly Share[]): ExactSplitCheck {
  const sum = shares.reduce((s, x) => s + x.sharePaise, 0);
  const diffPaise = amountPaise - sum;
  return diffPaise === 0 ? { ok: true } : { ok: false, diffPaise };
}

/**
 * Each member's net balance: what they paid, minus their shares, plus payments they made, minus
 * payments they received. Positive = gets money back, negative = owes. Always sums to 0.
 * Members with no rows are 0. Keys follow `memberIds` order.
 */
export function netBalances(
  memberIds: readonly string[],
  expenses: readonly BalanceExpense[],
  payments: readonly BalancePayment[],
): Map<string, number> {
  const net = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const add = (id: string, paise: number) => net.set(id, (net.get(id) ?? 0) + paise);
  for (const e of expenses) {
    add(e.paidById, e.amountPaise);
    for (const s of e.shares) add(s.memberId, -s.sharePaise);
  }
  for (const p of payments) {
    add(p.fromId, p.amountPaise);
    add(p.toId, -p.amountPaise);
  }
  return net;
}

/**
 * The payments that settle everyone up: the member who owes most pays the member owed most, then
 * again, until every balance is 0. At most n − 1 payments. Ties go to the earlier member in the
 * map's order, so the same balances always give the same list.
 */
export function simplifyDebts(balances: ReadonlyMap<string, number>): Transfer[] {
  const order = [...balances.keys()];
  const left = new Map(balances);
  const pick = (sign: 1 | -1): string | null => {
    let best: string | null = null;
    for (const id of order) {
      const v = (left.get(id) ?? 0) * sign;
      if (v > 0 && (best === null || v > (left.get(best) ?? 0) * sign)) best = id;
    }
    return best;
  };
  const transfers: Transfer[] = [];
  for (;;) {
    const debtor = pick(-1);
    const creditor = pick(1);
    if (!debtor || !creditor) break;
    const amountPaise = Math.min(-(left.get(debtor) ?? 0), left.get(creditor) ?? 0);
    transfers.push({ fromId: debtor, toId: creditor, amountPaise });
    left.set(debtor, (left.get(debtor) ?? 0) + amountPaise);
    left.set(creditor, (left.get(creditor) ?? 0) - amountPaise);
  }
  return transfers;
}
