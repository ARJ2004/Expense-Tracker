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
}

/** Safe area, 20 px side padding, the background token and an optional title header. */
export function Screen({ title, eyebrow, headerAction, withTabBar = false, children }: PropsWithChildren<ScreenProps>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, withTabBar && styles.tabBarSpace]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  tabBarSpace: { paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
