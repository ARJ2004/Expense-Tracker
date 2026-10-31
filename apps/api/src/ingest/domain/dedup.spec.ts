import { paise, type NormalizedTxn } from '@et/domain';
import { firstMatch, type DedupCandidate } from './pipeline';
import { DEDUP_RULES, TYPE_RULES } from './rules';
import { sourceHash } from './source-input';
import { trigramSimilarity } from './dedup';

/** 31 Oct 2026, IST midnight: how statement rows arrive. */
const DAY = new Date('2026-10-30T18:30:00Z');

const row = (over: Partial<NormalizedTxn> = {}): NormalizedTxn => ({
  source: 'statement',
  amountPaise: paise(48_600),
  direction: 'debit',
  occurredAt: DAY,
  timePrecision: 'day',
  counterparty: 'Swiggy Limited',
  ...over,
});

const candidate = (over: Partial<DedupCandidate> = {}): DedupCandidate => ({
  id: 't1',
  amountPaise: 48_600,
  direction: 'debit',
  occurredAt: new Date('2026-10-31T07:42:00Z'),
  accountId: null,
  referenceNo: null,
  merchantName: 'Swiggy',
  sourceKinds: ['manual'],
  ...over,
});

const dedup = (txn: NormalizedTxn, candidates: DedupCandidate[]) => firstMatch(DEDUP_RULES, (r) => r.find(txn, candidates));

describe('dedup rules', () => {
  it('1: same reference and amount merges, even across same-kind sources', () => {
    const c = candidate({ referenceNo: '427512345678', sourceKinds: ['statement'], occurredAt: new Date('2026-10-20T00:00:00Z') });
    expect(dedup(row({ referenceNo: '427512345678' }), [c])).toEqual({ transactionId: 't1', action: 'merge', rule: 'reference' });
    expect(dedup(row({ referenceNo: '427512345678', amountPaise: paise(1) }), [c])).toBeNull();
  });

  it('2: same account, amount and direction on the same IST day merges', () => {
    const c = candidate({ accountId: 'a1', merchantName: 'Lunch' });
    expect(dedup(row({ accountId: 'a1' }), [c])?.rule).toBe('same-account-day');
    expect(dedup(row({ accountId: 'a1', direction: 'credit' }), [c])).toBeNull();
  });

  it('3: unknown account on one side with a similar merchant merges', () => {
    expect(dedup(row({ accountId: 'a1' }), [candidate()])?.rule).toBe('similar-counterparty');
    expect(dedup(row({ accountId: 'a1' }), [candidate({ merchantName: 'Rapido' })])?.rule).toBe('possible-duplicate');
  });

  it('4: same amount within 3 days is flagged, not merged; 4 days is new', () => {
    const near = candidate({ occurredAt: new Date('2026-10-28T10:00:00Z'), merchantName: 'Zomato' });
    expect(dedup(row(), [near])).toEqual({ transactionId: 't1', action: 'flag', rule: 'possible-duplicate' });
    const far = candidate({ occurredAt: new Date('2026-10-26T10:00:00Z'), merchantName: 'Zomato' });
    expect(dedup(row(), [far])).toBeNull();
  });

  it('never merges two rows of the same kind under rules 2–4', () => {
    expect(dedup(row({ accountId: 'a1' }), [candidate({ accountId: 'a1', sourceKinds: ['statement'] })])).toBeNull();
  });

  it('compares IST days, not UTC days', () => {
    // 31 Oct 00:10 IST is 30 Oct in UTC.
    const c = candidate({ accountId: 'a1', occurredAt: new Date('2026-10-30T18:40:00Z') });
    expect(dedup(row({ accountId: 'a1' }), [c])?.rule).toBe('same-account-day');
  });
});

describe('trigramSimilarity', () => {
  it('matches pg_trgm on simple cases', () => {
    expect(trigramSimilarity('Swiggy', 'swiggy')).toBe(1);
    expect(trigramSimilarity('Swiggy Limited', 'Swiggy')).toBe(1);
    expect(trigramSimilarity('Uber India Systems Pvt', 'Uber')).toBe(1);
    expect(trigramSimilarity('Zomato', 'Zomato Ltd')).toBe(1);
    expect(trigramSimilarity('Swiggy Instamart', 'Swiggy')).toBeLessThan(0.6);
    expect(trigramSimilarity('Swiggy', 'Zomato')).toBe(0);
    expect(trigramSimilarity('', 'Swiggy')).toBe(0);
  });
});

describe('type rules', () => {
  const classify = (t: NormalizedTxn, own: string[] = []) => firstMatch(TYPE_RULES, (r) => r.classify(t, { ownAccountLast4: own }));
  it.each([
    [{ narration: 'ATW-416021XXXXXX4321-S1ANBG12-BANGALORE' }, 'atm_withdrawal'],
    [{ narration: 'NWD-416021XXXXXX4321-BLR' }, 'atm_withdrawal'],
    [{ narration: 'IMPS-428512345681-AMAZON-REFUND', direction: 'credit' as const }, 'refund'],
    [{ narration: 'CASH DEPOSIT BY SELF', direction: 'credit' as const }, 'cash_deposit'],
    [{ narration: 'NEFT-SELF-HDFC0000001', direction: 'credit' as const }, 'transfer'],
    [{ narration: 'BY CASH CDM 1234', direction: 'credit' as const }, 'cash_deposit'],
    [{ narration: 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK' }, 'expense'],
    [{ narration: 'NEFT CR-ACME-SALARY', direction: 'credit' as const }, 'income'],
  ])('%o → %s', (over, type) => expect(classify(row(over))).toBe(type));

  it('sees a transfer to another own account by its last 4', () => {
    expect(classify(row({ narration: 'IMPS-428512345681-TO A/C XXXXXXXX5521' }), ['5521'])).toBe('transfer');
    expect(classify(row({ narration: 'IMPS-428512345681-TO A/C XXXXXXXX5521' }), ['9999'])).toBe('expense');
  });
});

describe('statement sourceHash', () => {
  const input = { kind: 'statement' as const, date: '2026-10-31', amountPaise: 48_600, direction: 'debit' as const, narration: 'UPI-SWIGGY', nth: 1 };
  it('is the same for the same row and differs for its identical twin', () => {
    expect(sourceHash('u1', input)).toBe(sourceHash('u1', { ...input, narration: ' upi-swiggy ' }));
    expect(sourceHash('u1', input)).not.toBe(sourceHash('u1', { ...input, nth: 2 }));
    expect(sourceHash('u1', input)).not.toBe(sourceHash('u1', { kind: 'manual', clientRequestId: 'x' }));
  });
});

describe('categoryForType', () => {
  const { categoryForType } = jest.requireActual<typeof import('./rules/type-category')>('./rules/type-category');
  const other = { categoryId: 'other', source: 'default' as const };
  it('puts uncategorized ATM withdrawals and transfers in Transfers, and leaves rule hits alone', () => {
    expect(categoryForType(other, 'atm_withdrawal')).toEqual({ categoryId: "00000000-0000-7000-8000-000000000011", source: 'rule' });
    expect(categoryForType(other, 'transfer').source).toBe('rule');
    expect(categoryForType(other, 'expense')).toBe(other);
    const food = { categoryId: 'food', source: 'rule' as const };
    expect(categoryForType(food, 'atm_withdrawal')).toBe(food);
  });
});
