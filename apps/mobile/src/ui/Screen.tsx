import React, { type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, useTheme } from '../theme';
import { Text } from './Text';

export interface ScreenProps {
  title?: string;
  /** Small line above the title, e.g. "Good evening". */
  eyebrow?: string;
  /** Right side of the header, e.g. an IconButton. */
  headerAction?: ReactNode;
  /** Leave room at the bottom for the floating tab bar. */
  withTabBar?: boolean;
  /** Pinned under the scrolling content, e.g. Continue and Skip on onboarding steps. */
  footer?: ReactNode;
}

/** Safe area, 20 px side padding, the background token and an optional title header. */
export function Screen({ title, eyebrow, headerAction, withTabBar = false, footer, children }: PropsWithChildren<ScreenProps>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={footer ? ['top', 'bottom'] : ['top']} style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, withTabBar && styles.tabBarSpace]}>
        {(title || headerAction) && (
          <View style={styles.header}>
            <View>
              {eyebrow && (
                <Text variant="secondary" tone="muted">
                  {eyebrow}
                </Text>
              )}
              {title && (
                <Text variant="title" accessibilityRole="header">
                  {title}
                </Text>
              )}
            </View>
            {headerAction}
          </View>
        )}
        {children}
      </ScrollView>
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  tabBarSpace: { paddingBottom: 110 },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl, gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
