import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { radius, touchTarget, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls must be announced by screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: 'plain' | 'outlined';
}

export function IconButton({ icon, accessibilityLabel, onPress, variant = 'outlined' }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        variant === 'outlined' && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} color={colors.text} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: touchTarget, height: touchTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
