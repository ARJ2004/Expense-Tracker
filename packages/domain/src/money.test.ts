import { formatINR, paise, toPaise } from './money';

describe('toPaise', () => {
  it.each([
    ['486', 48600],
    ['486.5', 48650],
    ['486.50', 48650],
    ['1,23,456.78', 12345678],
    ['₹ 250.00', 25000],
    ['0.07', 7],
    ['-12', -1200],
  ])('parses %s', (input, expected) => {
    expect(toPaise(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '1..2', '₹'])('rejects %s', (input) => {
    expect(() => toPaise(input)).toThrow(RangeError);
  });

  it('avoids floating point drift', () => {
    expect(toPaise('0.29')).toBe(29); // 0.29 * 100 = 28.999999999999996 in floats
  });
});

describe('paise', () => {
  it('rejects fractions', () => {
    expect(() => paise(10.5)).toThrow(RangeError);
  });
});

describe('formatINR', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(paise(12345600))).toBe('₹1,23,456.00');
    expect(formatINR(paise(123456789))).toBe('₹12,34,567.89');
    expect(formatINR(paise(99900))).toBe('₹999.00');
  });

  it('supports auto decimals, signs and no symbol', () => {
    expect(formatINR(paise(4218000), { decimals: 'auto' })).toBe('₹42,180');
    expect(formatINR(paise(-48600), { symbol: false })).toBe('−486.00');
    expect(formatINR(paise(7500000), { signed: true, decimals: 'auto' })).toBe('+₹75,000');
    expect(formatINR(paise(0), { signed: true })).toBe('₹0.00');
  });
});
