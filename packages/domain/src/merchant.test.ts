import { activeFilterCount, isDayKey, istDayRange } from './ledger-filters';
import { merchantKey } from './merchant';

describe('merchantKey', () => {
  it('folds case, punctuation and spacing', () => {
    expect(merchantKey('Swiggy')).toBe('SWIGGY');
    expect(merchantKey(' swiggy. ')).toBe('SWIGGY');
    expect(merchantKey('Big-Basket  (BB)')).toBe('BIG BASKET BB');
    expect(merchantKey('Café 24/7')).toBe('CAFÉ 24 7');
  });

  it('is null for empty or symbol-only names', () => {
    expect(merchantKey(null)).toBeNull();
    expect(merchantKey('')).toBeNull();
    expect(merchantKey(' -- ')).toBeNull();
  });
});

describe('istDayRange', () => {
  it('starts at IST midnight', () => {
    const { start, end } = istDayRange('2026-10-31');
    expect(start.toISOString()).toBe('2026-10-30T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
});

describe('isDayKey', () => {
  it('accepts real dates only', () => {
    expect(isDayKey('2026-10-31')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('31-10-2026')).toBe(false);
  });
});

describe('activeFilterCount', () => {
  it('counts each filter once and ignores search', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: 'swiggy', categoryIds: [] })).toBe(0);
    expect(activeFilterCount({ from: '2026-10-01', to: '2026-10-31', categoryIds: ['a', 'b'], minAmountPaise: 100 })).toBe(3);
  });
});
