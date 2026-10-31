import { sumByIstDay } from './day-totals';
import { afterCursor, decodeCursor, encodeCursor, escapeLike, ledgerWhere } from './ledger-filter';

describe('ledgerWhere', () => {
  it('scopes to the user and skips deleted rows with no filters', () => {
    expect(ledgerWhere('u1', {})).toEqual({ userId: 'u1', deletedAt: null });
  });

  it('turns IST days into UTC bounds and amounts into bigint', () => {
    const where = ledgerWhere('u1', { from: '2026-10-01', to: '2026-10-31', minAmountPaise: 100, maxAmountPaise: 5000 });
    expect(where.AND).toEqual([
      { occurredAt: { gte: new Date('2026-09-30T18:30:00Z'), lt: new Date('2026-10-31T18:30:00Z') } },
      { amountPaise: { gte: 100n, lte: 5000n } },
    ]);
  });

  it('maps the remaining filters', () => {
    expect(ledgerWhere('u1', { direction: 'debit', type: 'expense', accountId: 'a', categoryIds: ['c1', 'c2'], source: 'sms', q: 'swig' })).toEqual({
      userId: 'u1',
      deletedAt: null,
      direction: 'debit',
      type: 'expense',
      accountId: 'a',
      categoryId: { in: ['c1', 'c2'] },
      sources: { some: { source: 'sms' } },
      AND: [{ OR: [{ merchantName: { contains: 'swig', mode: 'insensitive' } }, { note: { contains: 'swig', mode: 'insensitive' } }] }],
    });
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50% off_now\\x')).toBe('50\\% off\\_now\\\\x');
    expect(escapeLike('swiggy')).toBe('swiggy');
  });
});

describe('cursor', () => {
  const c = { occurredAt: new Date('2026-10-31T07:42:00Z'), id: '0192f0a1-0000-7000-8000-000000000001' };

  it('round-trips', () => {
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('rejects anything else', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('12.x').toString('base64url'))).toBeNull();
  });

  it('pages strictly after the cursor row', () => {
    expect(afterCursor(c)).toEqual({ OR: [{ occurredAt: { lt: c.occurredAt } }, { occurredAt: c.occurredAt, id: { lt: c.id } }] });
  });
});

describe('sumByIstDay', () => {
  it('groups by IST day, newest first, with net', () => {
    const rows = [
      { occurredAt: new Date('2026-10-31T07:42:00Z'), direction: 'debit' as const, amountPaise: 48_600n },
      { occurredAt: new Date('2026-10-30T19:00:00Z'), direction: 'debit' as const, amountPaise: 23_800n }, // 31 Oct 00:30 IST
      { occurredAt: new Date('2026-10-30T10:00:00Z'), direction: 'credit' as const, amountPaise: 7_500_000n },
    ];
    expect(sumByIstDay(rows)).toEqual([
      { date: '2026-10-31', debitPaise: 72_400, creditPaise: 0, netPaise: -72_400 },
      { date: '2026-10-30', debitPaise: 0, creditPaise: 7_500_000, netPaise: 7_500_000 },
    ]);
  });
});
