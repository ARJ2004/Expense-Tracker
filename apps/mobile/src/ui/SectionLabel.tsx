import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../theme';
import { Text } from './Text';

export interface SectionLabelProps {
  label: string;
  /** Right side, e.g. a day total. */
  trailing?: ReactNode;
}

/** Small upper-case muted heading (Transactions day headers, Settings groups, filter sections). */
export function SectionLabel({ label, trailing }: SectionLabelProps) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <Text variant="label" tone="muted" style={styles.label}>
        {label.toUpperCase()}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: space.xs },
  label: { fontSize: 13, letterSpacing: 0.5 },
});
