import { toPaise } from '@et/domain';
import { applyKey, isPositiveAmount, type KeypadKey } from '../src/components/keypad';

const type = (keys: string) => [...keys].reduce((v, k) => applyKey(v, (k === '<' ? 'back' : k) as KeypadKey), '');

describe('applyKey', () => {
  it('builds exact paise through toPaise, never floats', () => {
    expect(toPaise(type('486.50'))).toBe(48_650);
    expect(toPaise(type('0.1'))).toBe(10);
    expect(toPaise(type('1234567.89'))).toBe(123_456_789);
  });

  it('allows at most 2 decimals and one point', () => {
    expect(type('12.345')).toBe('12.34');
    expect(type('1..2')).toBe('1.2');
  });

  it('drops leading zeros and starts "." as "0."', () => {
    expect(type('007')).toBe('7');
    expect(type('.5')).toBe('0.5');
  });

  it('caps the whole part at 9 digits', () => {
    expect(type('12345678901')).toBe('123456789');
  });

  it('deletes one character at a time', () => {
    expect(type('486<<')).toBe('4');
    expect(type('<')).toBe('');
  });

  it('knows when the amount is positive', () => {
    expect(isPositiveAmount('')).toBe(false);
    expect(isPositiveAmount('0.00')).toBe(false);
    expect(isPositiveAmount('0.05')).toBe(true);
  });
});
