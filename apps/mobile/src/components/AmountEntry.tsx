import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatINR, toPaise } from '@et/domain';
import { fonts, useTheme } from '../theme';
import { Text } from '../ui';

export interface AmountEntryProps {
  /** The typed rupee string from AmountKeypad. */
  value: string;
}

/** Centered "₹ 4,860.5" while typing: Indian grouping on the whole part, decimals exactly as typed. */
export function AmountEntry({ value }: AmountEntryProps) {
  const { colors } = useTheme();
  const [whole = '', fraction] = value.split('.');
  const grouped = formatINR(toPaise(whole || '0'), { symbol: false, decimals: 'auto' });
  const shown = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Amount ₹${shown}`}
      style={styles.row}
    >
      <Text style={[styles.symbol, { color: colors.textMuted }]}>₹</Text>
      <Text style={[styles.amount, { color: value === '' ? colors.textMuted : colors.text }]}>{shown}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 6, paddingVertical: 6 },
  symbol: { fontFamily: fonts.monoMedium, fontSize: 26, lineHeight: 34 },
  amount: { fontFamily: fonts.monoSemibold, fontSize: 48, lineHeight: 56, letterSpacing: -1.9 },
});
