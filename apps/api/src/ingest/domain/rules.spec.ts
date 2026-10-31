import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID, paise, type NormalizedTxn } from '@et/domain';
import { firstMatch } from './pipeline';
import { CATEGORY_RULES, TYPE_RULES } from './rules';
import { sourceHash } from './source-input';

const txn = (over: Partial<NormalizedTxn> = {}): NormalizedTxn => ({
  source: 'manual',
  amountPaise: paise(48_600),
  direction: 'debit',
  occurredAt: new Date('2026-10-31T07:42:00Z'),
  timePrecision: 'minute',
  ...over,
});

const categorize = (t: NormalizedTxn) => firstMatch(CATEGORY_RULES, (r) => r.apply(t));
const classify = (t: NormalizedTxn) => firstMatch(TYPE_RULES, (r) => r.classify(t));

describe('category rules', () => {
  it("uses the user's pick", () => {
    expect(categorize(txn({ categoryId: 'c-1' }))).toEqual({ categoryId: 'c-1', source: 'user' });
  });

  it('falls back to Other for debits and Income for credits', () => {
    expect(categorize(txn())).toEqual({ categoryId: OTHER_CATEGORY_ID, source: 'default' });
    expect(categorize(txn({ direction: 'credit' }))).toEqual({ categoryId: INCOME_CATEGORY_ID, source: 'default' });
  });
});

describe('type rules', () => {
  it('maps direction to expense or income', () => {
    expect(classify(txn())).toBe('expense');
    expect(classify(txn({ direction: 'credit' }))).toBe('income');
  });
});

describe('sourceHash', () => {
  it('is stable per user and request id, and differs across users', () => {
    const a = sourceHash('u1', { kind: 'manual', clientRequestId: 'ABC' });
    expect(a).toBe(sourceHash('u1', { kind: 'manual', clientRequestId: 'abc' }));
    expect(a).not.toBe(sourceHash('u2', { kind: 'manual', clientRequestId: 'abc' }));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
