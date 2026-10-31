/**
 * Money is always an integer number of paise (₹1 = 100 paise). Never use floats for amounts.
 */
declare const paiseBrand: unique symbol;
export type Paise = number & { readonly [paiseBrand]: true };

const RUPEE_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Builds a Paise value from an integer, rejecting fractions and unsafe sizes. */
export function paise(value: number): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Paise must be a safe integer, got ${value}`);
  }
  return value as Paise;
}

/**
 * Parses a rupee amount as typed or printed ("486", "486.5", "1,23,456.78", "₹ 250.00")
 * into paise without going through floating point.
 */
/** Largest amount accepted anywhere: ₹99,99,99,999.99. */
export const MAX_AMOUNT_PAISE = 99_99_99_99_999;

export function toPaise(rupees: string): Paise {
  const cleaned = rupees.replace(/[₹,\s]/g, '');
  const match = RUPEE_PATTERN.exec(cleaned);
  if (!match) {
    throw new RangeError(`Not a rupee amount: "${rupees}"`);
  }
  const [, minus, whole = '0', fraction = ''] = match;
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return paise(minus ? -value : value);
}

export interface FormatINROptions {
  /** Prefix "₹". Default true. */
  symbol?: boolean;
  /** "auto" drops ".00" on whole rupees; "always" keeps two decimals. Default "always". */
  decimals?: 'auto' | 'always';
  /** Show "+" for positive values (credits). Negative values always show "−". Default false. */
  signed?: boolean;
}

/** Groups digits the Indian way: 1,23,45,678. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Formats paise as rupees, e.g. 12345600 → "₹1,23,456.00". */
export function formatINR(amount: Paise | number, options: FormatINROptions = {}): string {
  const { symbol = true, decimals = 'always', signed = false } = options;
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = groupIndian(String(Math.floor(abs / 100)));
  const fraction = String(abs % 100).padStart(2, '0');
  const body = decimals === 'auto' && fraction === '00' ? whole : `${whole}.${fraction}`;
  const sign = negative ? '−' : signed && abs > 0 ? '+' : '';
  return `${sign}${symbol ? '₹' : ''}${body}`;
}
