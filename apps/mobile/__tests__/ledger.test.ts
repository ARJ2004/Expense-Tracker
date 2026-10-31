import type { TransactionSummary } from '@et/api-client';
import { dayLabel, filtersToQuery, presetOf, presetRange, toLedgerItems } from '../src/features/transactions/ledger';

// 31 Oct 2026, 6:00 pm IST.
const NOW = new Date('2026-10-31T12:30:00Z');

const row = (id: string, occurredAt: string): TransactionSummary => ({
  id,
  amountPaise: 48_600,
  direction: 'debit',
  type: 'expense',
  occurredAt,
  merchantName: 'Swiggy',
  category: { id: 'c1', name: 'Food & Dining', icon: 'food', color: 'chart2' },
  account: null,
});

describe('dayLabel', () => {
  it('names today and yesterday, then the date, with the year only for other years', () => {
    expect(dayLabel('2026-10-31', NOW)).toBe('Today');
    expect(dayLabel('2026-10-30', NOW)).toBe('Yesterday · 30 Oct');
    expect(dayLabel('2026-10-29', NOW)).toBe('29 Oct');
    expect(dayLabel('2025-12-31', NOW)).toBe('31 Dec 2025');
  });
});

describe('toLedgerItems', () => {
  it('puts a header with the API day total before each IST day', () => {
    const items = toLedgerItems(
      [row('a', '2026-10-31T07:42:00Z'), row('b', '2026-10-30T19:00:00Z'), row('c', '2026-10-30T10:00:00Z')],
      [
        { date: '2026-10-31', debitPaise: 97_200, creditPaise: 0, netPaise: -97_200 },
        { date: '2026-10-30', debitPaise: 48_600, creditPaise: 0, netPaise: -48_600 },
      ],
      NOW,
    );
    expect(items.map((i) => (i.kind === 'day' ? `${i.label} ${i.netPaise}` : i.key))).toEqual([
      'Today -97200',
      'a',
      'b', // 30 Oct 19:00 UTC is 31 Oct 00:30 IST
      'Yesterday · 30 Oct -48600',
      'c',
    ]);
  });

  it('is empty for no rows', () => {
    expect(toLedgerItems([], [], NOW)).toEqual([]);
  });
});

describe('filtersToQuery', () => {
  it('sends categories as repeated categoryId and drops empty values', () => {
    expect(filtersToQuery({ categoryIds: ['c1', 'c2'], direction: 'debit', q: '', minAmountPaise: undefined })).toEqual({
      categoryId: ['c1', 'c2'],
      direction: 'debit',
    });
    expect(filtersToQuery({ categoryIds: [] })).toEqual({});
  });
});

describe('date presets', () => {
  it('computes IST month and 90-day ranges and recognises them again', () => {
    expect(presetRange('this_month', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('last_month', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('last_90_days', NOW)).toEqual({ from: '2026-08-03', to: '2026-10-31' });
    expect(presetRange('any', NOW)).toEqual({});
    expect(presetOf({ from: '2026-09-01', to: '2026-09-30' }, NOW)).toBe('last_month');
    expect(presetOf({}, NOW)).toBe('any');
  });

  it('handles January (last month is December of the year before)', () => {
    expect(presetRange('last_month', new Date('2027-01-15T06:00:00Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
