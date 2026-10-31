import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { radius, space, touchTarget, useTheme } from '../theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading glyph, e.g. a category icon; receives the label colour. */
  renderIcon?: (color: string) => React.ReactNode;
}

const HEIGHT = 36;
const SLOP = (touchTarget - HEIGHT) / 2;

/** Pill toggle. Selected: navy with white text (light), emerald with navy text (dark). 44 px touch area. */
export function Chip({ label, selected = false, onPress, renderIcon }: ChipProps) {
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
      {renderIcon?.(selected ? colors.chipOnFg : colors.text)}
      <Text variant="bodyStrong" style={[styles.label, { color: selected ? colors.chipOnFg : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  renderIcon?: ChipProps['renderIcon'];
}

export interface ChipGroupProps<T extends string> {
  options: ReadonlyArray<ChipOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** One scrolling row instead of wrapping lines. */
  scroll?: boolean;
}

/** Single-choice row of chips that wraps onto new lines. */
export function ChipGroup<T extends string>({ options, value, onChange, accessibilityLabel, scroll = false }: ChipGroupProps<T>) {
  const Container = scroll ? ScrollView : View;
  const layout = scroll ? { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.row } : { style: styles.group };
  return (
    <Container accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} {...layout}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} renderIcon={o.renderIcon} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: { height: HEIGHT, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 14 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, rowGap: space.sm },
  row: { flexDirection: 'row', gap: space.xs, paddingVertical: SLOP },
});
