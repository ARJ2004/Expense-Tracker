export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

const MAX_WHOLE_DIGITS = 9;
const MAX_DECIMALS = 2;

/**
 * Applies one key press to the typed rupee string ("486", "486.5"). Pure, so the money rules are
 * testable: at most 2 decimals, at most 9 whole digits, no leading zeros, one decimal point.
 * The string is turned into paise only with toPaise(), never parsed as a float.
 */
export function applyKey(value: string, key: KeypadKey): string {
  if (key === 'back') return value.slice(0, -1);
  const [whole = '', fraction] = value.split('.');
  if (key === '.') {
    if (fraction !== undefined) return value;
    return `${whole || '0'}.`;
  }
  if (fraction !== undefined) return fraction.length >= MAX_DECIMALS ? value : value + key;
  if (whole === '0') return key;
  if (whole.length >= MAX_WHOLE_DIGITS) return value;
  return value + key;
}

/** True when the typed string is a positive amount (not "", "0", "0." or "0.00"). */
export function isPositiveAmount(value: string): boolean {
  return /[1-9]/.test(value);
}
