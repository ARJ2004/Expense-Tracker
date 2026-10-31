import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space, touchTarget, useTheme } from '../theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

const HEIGHT = 36;
const SLOP = (touchTarget - HEIGHT) / 2;

/** Pill toggle. Selected: navy with white text (light), emerald with navy text (dark). 44 px touch area. */
export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      hitSlop={{ top: SLOP, bottom: SLOP }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.chipOnBg, borderColor: colors.chipOnBg }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text variant="bodyStrong" style={[styles.label, { color: selected ? colors.chipOnFg : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface ChipGroupProps<T extends string> {
  options: ReadonlyArray<ChipOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Single-choice row of chips that wraps onto new lines. */
export function ChipGroup<T extends string>({ options, value, onChange, accessibilityLabel }: ChipGroupProps<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.group}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: HEIGHT, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  label: { fontSize: 14 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, rowGap: space.sm },
});
