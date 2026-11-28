import { formatINR } from './money';

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

// ---- Sharing (F13) ----

/** Crockford base32: no I, L, O or U, so a code read aloud or typed by hand survives. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 10;

/** A join code from random bytes: 10 Crockford characters, 50 bits. `bytes` needs ≥ 7 values. */
export function inviteCodeFrom(bytes: ArrayLike<number>): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length && out.length < INVITE_CODE_LENGTH; i++) {
    value = (value << 8) | ((bytes[i] ?? 0) & 0xff);
    bits += 8;
    while (bits >= 5 && out.length < INVITE_CODE_LENGTH) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (out.length < INVITE_CODE_LENGTH) throw new RangeError('Not enough random bytes for a join code');
  return out;
}

/**
 * A code as someone typed or pasted it ("k7q2-m9xp4r", "K7Q2 M9XP4R", a whole link) → "K7Q2M9XP4R",
 * or null when it can't be one. O reads as 0 and I/L as 1, as Crockford intends.
 */
export function normalizeInviteCode(input: string): string | null {
  const fromLink = /\/j\/([^/?#\s]+)/i.exec(input)?.[1] ?? input;
  const code = fromLink.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return code.length === INVITE_CODE_LENGTH && [...code].every((c) => CROCKFORD.includes(c)) ? code : null;
}

/** "K7Q2M9XP4R" → "K7Q2-M9XP4R", for reading aloud. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * A name for someone joining that no member has yet: "Ravi", else "Ravi 2", "Ravi 3"… Trimmed to
 * the member name limit.
 */
export function uniqueMemberName(taken: readonly string[], wanted: string): string {
  const keys = new Set(taken.map(memberNameKey));
  const base = (wanted.trim().replace(/\s+/g, ' ') || 'Member').slice(0, GROUP_LIMITS.memberNameLength.max);
  if (!keys.has(memberNameKey(base))) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = base.slice(0, GROUP_LIMITS.memberNameLength.max - suffix.length) + suffix;
    if (!keys.has(memberNameKey(name))) return name;
  }
}

export const GROUP_EVENT_TYPES = [
  'group.created',
  'group.renamed',
  'member.added',
  'member.renamed',
  'member.removed',
  'member.joined',
  'member.left',
  'member.unlinked',
  'owner.changed',
  'invite.reset',
  'expense.created',
  'expense.updated',
  'expense.deleted',
  'payment.created',
  'payment.deleted',
] as const;
export type GroupEventType = (typeof GROUP_EVENT_TYPES)[number];

/** Display values a history row keeps; never anything from anyone's personal data. */
export interface GroupEventSummary {
  name?: string;
  from?: string;
  to?: string;
  description?: string;
  amountPaise?: number;
  before?: { description?: string; amountPaise?: number };
  claimed?: boolean;
}

const inr = (paise: number | undefined) => formatINR(Math.abs(paise ?? 0), { decimals: 'auto' });

/**
 * What happened, without the actor (the app puts "You" or the member's name in front):
 * "added Dinner · ₹3,600", "changed Dinner from ₹3,600 to ₹3,200", "joined as Ravi".
 */
export function groupEventText(type: GroupEventType, s: GroupEventSummary): string {
  switch (type) {
    case 'group.created':
      return `created the group`;
    case 'group.renamed':
      return `renamed the group to ${s.to}`;
    case 'member.added':
      return `added ${s.name}`;
    case 'member.renamed':
      return `renamed ${s.from} to ${s.to}`;
    case 'member.removed':
      return `removed ${s.name}`;
    case 'member.joined':
      return s.claimed ? `joined as ${s.name}` : `joined the group`;
    case 'member.left':
      return `left the group`;
    case 'member.unlinked':
      return `removed ${s.name} from the group`;
    case 'owner.changed':
      return `made ${s.name} the owner`;
    case 'invite.reset':
      return `reset the invite link`;
    case 'expense.created':
      return `added ${s.description} · ${inr(s.amountPaise)}`;
    case 'expense.updated': {
      const b = s.before ?? {};
      if (b.amountPaise !== undefined && b.amountPaise !== s.amountPaise) {
        return `changed ${s.description} from ${inr(b.amountPaise)} to ${inr(s.amountPaise)}`;
      }
      if (b.description && b.description !== s.description) return `renamed ${b.description} to ${s.description}`;
      return `edited ${s.description}`;
    }
    case 'expense.deleted':
      return `deleted ${s.description} · ${inr(s.amountPaise)}`;
    case 'payment.created':
      return `recorded ${s.from} paid ${s.to} ${inr(s.amountPaise)}`;
    case 'payment.deleted':
      return `deleted the payment ${s.from} → ${s.to} ${inr(s.amountPaise)}`;
  }
}
