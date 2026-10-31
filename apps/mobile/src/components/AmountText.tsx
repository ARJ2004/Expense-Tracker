import React from 'react';
import { formatINR, type Paise } from '@et/domain';
import { Text, type TextProps } from '../ui';

export interface AmountTextProps {
  /** Positive paise; `direction` decides the sign. */
  paise: Paise | number;
  /** Debits show "−", credits "+", so colour is never the only cue. */
  direction?: 'debit' | 'credit';
  /** Colour only. "income"/"spend" without a direction still add the matching sign. */
  tone?: 'default' | 'muted' | 'income' | 'spend';
  variant?: 'mono' | 'hero';
  /** "auto" drops ".00" on whole rupees. */
  decimals?: 'auto' | 'always';
  /** Show "₹". Lists drop it (the locked Home rows read "−486.00"). */
  symbol?: boolean;
  style?: TextProps['style'];
}

/** Every rupee amount on screen: Indian grouping, IBM Plex Mono, tone from the theme. */
export function AmountText({ paise, direction, tone = 'default', variant = 'mono', decimals = 'auto', symbol = true, style }: AmountTextProps) {
  const sign = direction ?? (tone === 'spend' ? 'debit' : tone === 'income' ? 'credit' : undefined);
  const abs = Math.abs(paise);
  const value = sign === 'debit' ? -abs : abs;
  return (
    <Text variant={variant} tone={tone} style={style}>
      {formatINR(value, { decimals, signed: sign === 'credit', symbol })}
    </Text>
  );
}
