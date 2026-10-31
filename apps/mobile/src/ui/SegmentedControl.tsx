import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, useTheme } from '../theme';
import type { ChipOption } from './Chip';
import { Text } from './Text';

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Equal-width pill segments; the selected one uses the chip-on colours (Debit / Credit). */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: colors.chipOnBg }]}
          >
            <Text variant="bodyStrong" style={[styles.label, { color: selected ? colors.chipOnFg : colors.textMuted }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, borderWidth: 1 },
  segment: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14 },
});
