import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, useTheme } from '../theme';

export interface HeroSurfaceProps {
  children: ReactNode;
}

/** The navy card hero content sits on (Home and Budgets' HeroCard, the Sign in pitch). */
export function HeroSurface({ children }: HeroSurfaceProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.hero, borderColor: colors.heroBorder }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: 22, gap: 10 },
});
