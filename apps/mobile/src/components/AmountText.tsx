import React from 'react';
import { formatINR, type Paise } from '@et/domain';
import { Text, type TextProps } from '../ui';

export interface AmountTextProps {
  paise: Paise;
  /** "income" and "spend" also add a +/− sign, so colour is never the only cue. */
  tone?: 'default' | 'muted' | 'income' | 'spend';
  variant?: 'mono' | 'hero';
  /** "auto" drops ".00" on whole rupees. */
  decimals?: 'auto' | 'always';
  style?: TextProps['style'];
}

/** Every rupee amount on screen: Indian grouping, IBM Plex Mono, tone from the theme. */
export function AmountText({ paise, tone = 'default', variant = 'mono', decimals = 'auto', style }: AmountTextProps) {
  const signed = tone === 'income' || tone === 'spend';
  const value = tone === 'spend' && paise > 0 ? (-paise as Paise) : paise;
  return (
    <Text variant={variant} tone={tone} style={style}>
      {formatINR(value, { decimals, signed })}
    </Text>
  );
}
