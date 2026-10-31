import { bigintToNumber } from './bigint.interceptor';

describe('bigintToNumber', () => {
  it('converts nested bigint amounts and leaves other values alone', () => {
    const when = new Date('2026-11-02T00:00:00Z');
    expect(
      bigintToNumber({ amountPaise: BigInt(48600), rows: [{ amountPaise: BigInt(7) }], when, note: null }),
    ).toEqual({ amountPaise: 48600, rows: [{ amountPaise: 7 }], when, note: null });
  });

  it('refuses values beyond the safe integer range', () => {
    expect(() => bigintToNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).toThrow(RangeError);
  });
});
