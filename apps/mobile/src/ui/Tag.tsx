import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '../theme';
import { Text } from './Text';

export type TagTone = 'success' | 'warning' | 'error' | 'neutral';

export interface TagProps {
  label: string;
  tone?: TagTone;
}

/** Small pill label on a soft background (category on Detail, import status). */
export function Tag({ label, tone = 'success' }: TagProps) {
  const { colors } = useTheme();
  const look = {
    success: { bg: colors.accentSoft, fg: colors.accentOnSoft },
    warning: { bg: colors.warningSoft, fg: colors.warningOn },
    error: { bg: colors.errorSoft, fg: colors.errorOn },
    neutral: { bg: colors.track, fg: colors.text },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: look.bg }]}>
      <Text variant="label" style={[styles.text, { color: look.fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'center' },
  text: { fontFamily: fonts.bold },
});
