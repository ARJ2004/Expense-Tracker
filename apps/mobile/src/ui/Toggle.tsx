import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { space, touchTarget, useTheme } from '../theme';
import { Text } from './Text';

export interface ToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Smaller line under the label. */
  hint?: string;
}

/** A labelled on/off switch; the whole row is the touch target. */
export function Toggle({ label, value, onValueChange, hint }: ToggleProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {hint && (
          <Text variant="secondary" tone="muted">
            {hint}
          </Text>
        )}
      </View>
      <Switch
        importantForAccessibility="no-hide-descendants"
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.track, true: colors.accent }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.track}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { flex: 1, gap: 2 },
});
