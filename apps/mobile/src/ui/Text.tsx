import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { typeScale, useTheme, type TypeVariant } from '../theme';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  /** "muted" uses textMuted; any other value must come from theme colors. */
  tone?: 'default' | 'muted' | 'accent' | 'income' | 'spend';
}

/** Every piece of text in the app; maps a variant to the type scale and a tone to a token. */
export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    accent: colors.accent,
    income: colors.income,
    spend: colors.spend,
  }[tone];
  return <RNText {...rest} style={[typeScale[variant], { color }, style]} />;
}
