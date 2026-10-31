import { merchantKey, SYSTEM_CATEGORIES, type Direction } from '@et/domain';
import type { CategorizeContext, CategoryMatch } from './categorizer-rule';
import { MERCHANT_RULES } from './merchant-rules';
import { CATEGORIZER_RULES } from './rules';
import { compile } from './rules/global-merchant.rule';
import { KEYWORDS } from './rules/keyword.rule';

const idOf = (key: string) => SYSTEM_CATEGORIES.find((c) => c.key === key)!.id;
const keyOf = (id: string | undefined) => SYSTEM_CATEGORIES.find((c) => c.id === id)?.key ?? null;
const none: CategorizeContext = { userRuleCategoryId: null };

function categorize(
  merchant: string | null,
  options: { narration?: string; direction?: Direction; ctx?: CategorizeContext } = {},
): CategoryMatch | null {
  const input = { merchantKey: merchantKey(merchant), narration: options.narration ?? null, direction: options.direction ?? 'debit' };
  for (const rule of CATEGORIZER_RULES) {
    const hit = rule.apply(input, options.ctx ?? none);
    if (hit) return hit;
  }
  return null;
}

describe('global merchant rules', () => {
  it.each([
    ['Swiggy', 'food_dining'],
    ['SWIGGY*ORDER 12345', 'food_dining'],
    ['Zomato Ltd', 'food_dining'],
    ["Domino's Pizza", 'food_dining'],
    ['Starbucks Coffee', 'food_dining'],
    ['Swiggy Instamart', 'groceries'],
    ['Blinkit', 'groceries'],
    ['Zepto Marketplace', 'groceries'],
    ['BigBasket', 'groceries'],
    ['Big Basket', 'groceries'],
    ['DMart Avenue Supermarts', 'groceries'],
    ['Uber India', 'transport'],
    ['OLA Cabs', 'transport'],
    ['Rapido', 'transport'],
    ['Indian Oil Petrol Pump', 'transport'],
    ['FASTag Recharge', 'transport'],
    ['Airtel Prepaid Recharge', 'bills_utilities'],
    ['City Medical Store', 'health'],
    ['Amazon', 'shopping'],
    ['Amazon Pay India', 'shopping'],
    ['Flipkart Internet', 'shopping'],
    ['Myntra Designs', 'shopping'],
    ['Nykaa', 'shopping'],
    ['BESCOM', 'bills_utilities'],
    ['Airtel Postpaid', 'bills_utilities'],
    ['Reliance Jio', 'bills_utilities'],
    ['ACT Fibernet', 'bills_utilities'],
    ['Tata Play', 'bills_utilities'],
    ['NoBroker', 'rent'],
    ['Netflix', 'entertainment'],
    ['Spotify India', 'entertainment'],
    ['Amazon Prime Video', 'entertainment'],
    ['BookMyShow', 'entertainment'],
    ['PVR Cinemas', 'entertainment'],
    ['Apollo Pharmacy', 'health'],
    ['PharmEasy', 'health'],
    ['Tata 1mg', 'health'],
    ['cult.fit', 'health'],
    ['Udemy', 'education'],
    ['IRCTC', 'travel'],
    ['MakeMyTrip', 'travel'],
    ['IndiGo Airlines', 'travel'],
    ['OYO Rooms', 'travel'],
    ['CRED Club', 'transfers'],
  ])('%s → %s', (merchant, expected) => {
    expect(keyOf(categorize(merchant)?.categoryId)).toBe(expected);
  });

  it('matches whole words only', () => {
    expect(categorize('Violet Florist')).toBeNull(); // contains "VI" and "OLA" inside words
    expect(categorize('Actual Store')).toBeNull();
  });

  it('falls back to narration for longer patterns only', () => {
    expect(keyOf(categorize(null, { narration: 'UPI/412345/SWIGGY/swiggy@icici' })?.categoryId)).toBe('food_dining');
    expect(categorize(null, { narration: 'UPI/412345/VI/payment' })).toBeNull();
  });

  it('leaves unknown merchants alone', () => {
    expect(categorize('Sharma General Store')).toBeNull();
    expect(categorize(null)).toBeNull();
  });

  it('only names real system categories', () => {
    expect(() => compile(MERCHANT_RULES)).not.toThrow();
    expect(() => compile([{ category: 'pets', patterns: ['X'] }])).toThrow(/pets/);
    for (const k of KEYWORDS) expect(idOf(k.category)).toBeDefined();
  });

  it('has no pattern listed under two categories', () => {
    const seen = new Map<string, string>();
    for (const rule of MERCHANT_RULES) {
      for (const p of [...rule.patterns, ...(rule.generic ?? [])]) {
        expect([p, seen.get(p) ?? rule.category]).toEqual([p, rule.category]);
        seen.set(p, rule.category);
        expect(merchantKey(p)).toBe(p);
      }
    }
  });
});

describe('keyword rules', () => {
  it('reads salary and interest on credits only', () => {
    expect(keyOf(categorize('Acme Corp Salary', { direction: 'credit' })?.categoryId)).toBe('income');
    expect(keyOf(categorize(null, { narration: 'NEFT CR-ACME SAL OCT', direction: 'credit' })?.categoryId)).toBe('income');
    expect(categorize('Acme Corp Salary', { direction: 'debit' })).toBeNull();
  });

  it('reads rent on debits', () => {
    expect(keyOf(categorize('House rent October')?.categoryId)).toBe('rent');
    expect(categorize('Rent refund', { direction: 'credit' })).toBeNull();
  });
});

describe('user merchant rules', () => {
  it('beat the global list', () => {
    const own = idOf('groceries');
    expect(categorize('Swiggy', { ctx: { userRuleCategoryId: own } })).toEqual({ categoryId: own, rule: 'user-merchant' });
  });
});
