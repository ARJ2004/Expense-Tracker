import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '../theme';
import { Text } from '../ui';

export type AvatarTone = 'soft' | 'amber' | 'teal' | 'navy' | 'neutral';

export interface MerchantAvatarProps {
  name: string | null;
  size?: 'md' | 'lg';
  /**
   * "soft" (green), "amber" and "teal" tell people apart; "amber" also marks something that needs
   * a look (possible duplicate). "navy" is the user themself; "neutral" sits on the track colour.
   */
  tone?: AvatarTone;
  /** Shown instead of the initial, e.g. a group's icon. */
  emoji?: string | null;
}

/** Round initial (or emoji) on a soft tone; "?" when there's no name. Decorative. */
export function MerchantAvatar({ name, size = 'md', tone = 'soft', emoji }: MerchantAvatarProps) {
  const { colors } = useTheme();
  const dim = size === 'lg' ? 64 : 42;
  const initial = name?.trim().charAt(0).toUpperCase() || '?';
  const look = {
    soft: { bg: colors.accentSoft, fg: colors.accentOnSoft },
    amber: { bg: colors.warningSoft, fg: colors.warningOn },
    teal: { bg: colors.tealSoft, fg: colors.tealOn },
    navy: { bg: colors.primaryBg, fg: colors.primaryFg },
    neutral: { bg: colors.track, fg: colors.text },
  }[emoji ? 'neutral' : tone];
  return (
    <View importantForAccessibility="no-hide-descendants" style={[styles.circle, { width: dim, height: dim, backgroundColor: look.bg }]}>
      <Text style={[emoji ? styles.emoji : styles.initial, size === 'lg' ? styles.lg : styles.md, { color: look.fg }]}>{emoji || initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold },
  emoji: { textAlign: 'center' },
  md: { fontSize: 16 },
  lg: { fontSize: 22 },
});
