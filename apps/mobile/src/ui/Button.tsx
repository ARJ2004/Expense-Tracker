import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { fonts, radius, space, useTheme } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the parent's width. */
  block?: boolean;
  /** Drawn before the label, e.g. a brand mark ("Continue with Google"). */
  icon?: ReactNode;
}

/**
 * Primary: navy with white text (light), emerald with navy text (dark).
 * Secondary: surface with border. Danger: secondary with spend-coloured label. Text: label only.
 */
export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, block = false, icon }: ButtonProps) {
  const { colors } = useTheme();
  const look = {
    primary: { bg: colors.primaryBg, fg: colors.primaryFg, border: colors.primaryBg },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    danger: { bg: colors.surface, fg: colors.spend, border: colors.border },
    text: { bg: undefined, fg: colors.accent, border: undefined },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      // The label alone, so an icon's text (Google's "G") never becomes part of the name.
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        { backgroundColor: look.bg, borderColor: look.border, borderWidth: look.border ? 1 : 0 },
        (pressed || inactive) && styles.dim,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text variant="bodyStrong" style={[styles.label, { color: look.fg }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 56, paddingHorizontal: space.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  block: { alignSelf: 'stretch' },
  dim: { opacity: 0.7 },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: fonts.bold, fontSize: 16 },
});
