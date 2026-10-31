import React, { type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../theme';

export interface CardProps {
  /** "rows" uses tight vertical padding for stacked ListRows. */
  padding?: 'default' | 'rows';
  /** Accent border, for a focused field or a chosen option. */
  selected?: boolean;
}

export function Card({ children, padding = 'default', selected = false }: PropsWithChildren<CardProps>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.base, padding === 'rows' ? styles.rows : styles.default, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border }, selected && styles.selected]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.card, borderWidth: 1 },
  selected: { borderWidth: 2 },
  default: { paddingVertical: 18, paddingHorizontal: space.lg, gap: space.sm },
  rows: { paddingVertical: 2, paddingHorizontal: space.lg },
});
