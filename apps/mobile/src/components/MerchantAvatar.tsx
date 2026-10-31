import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '../theme';
import { Text } from '../ui';

export interface MerchantAvatarProps {
  name: string | null;
  size?: 'md' | 'lg';
  /** "amber" marks something that needs a look (possible duplicate, needs review). */
  tone?: 'soft' | 'amber';
}

/** Round initial of the merchant on a soft tone; "?" when there's no merchant. Decorative. */
export function MerchantAvatar({ name, size = 'md', tone = 'soft' }: MerchantAvatarProps) {
  const { colors } = useTheme();
  const dim = size === 'lg' ? 64 : 42;
  const initial = name?.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: dim, height: dim, backgroundColor: tone === 'amber' ? colors.warningSoft : colors.accentSoft },
      ]}
    >
      <Text style={[styles.initial, size === 'lg' ? styles.lg : styles.md, { color: tone === 'amber' ? colors.warningOn : colors.accentOnSoft }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold },
  md: { fontSize: 16 },
  lg: { fontSize: 22 },
});
