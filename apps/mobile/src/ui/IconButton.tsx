import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { radius, touchTarget, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls must be announced by screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** "filled" is the round close button on sheets (background-coloured disc). */
  variant?: 'plain' | 'outlined' | 'filled';
  /** A count in the corner, e.g. active filters; hidden at 0. Include it in accessibilityLabel too. */
  badge?: number;
}

export function IconButton({ icon, accessibilityLabel, onPress, variant = 'outlined', badge = 0 }: IconButtonProps) {
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
        variant === 'filled' && { backgroundColor: colors.background },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} color={colors.text} size={20} />
      {badge > 0 && (
        <Text variant="label" style={[styles.badge, { backgroundColor: colors.chipOnBg, color: colors.chipOnFg }]}>
          {badge}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: touchTarget, height: touchTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, textAlign: 'center', fontSize: 11, lineHeight: 18, overflow: 'hidden' },
});
