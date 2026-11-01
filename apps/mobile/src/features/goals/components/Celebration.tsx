import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui';
import { MILESTONE_COPY } from '../labels';

const SHOW_MS = 2600;

/**
 * A short "Halfway there!" over the screen when a contribution reaches a milestone. Tap to close;
 * it closes on its own. Without the pop when Android's "remove animations" is on.
 */
export function Celebration({ milestone, goalName, onDone }: { milestone: string | null; goalName: string; onDone: () => void }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.6)).current;
  const copy = milestone ? MILESTONE_COPY[milestone] : undefined;
  // The latest onDone without restarting the timer when the parent re-renders.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!copy) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) scale.setValue(1);
      else Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
      AccessibilityInfo.announceForAccessibility(`${copy.title}. ${goalName}`);
    });
    const timer = setTimeout(() => done.current(), SHOW_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      scale.setValue(0.6);
    };
  }, [copy, goalName, scale]);

  if (!copy) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onDone} accessibilityRole="button" accessibilityLabel="Close">
        <Animated.View style={[styles.card, { backgroundColor: colors.surface, transform: [{ scale }] }]}>
          <Text style={styles.emoji}>{copy.emoji}</Text>
          <Text variant="title" style={styles.center}>
            {copy.title}
          </Text>
          <Text variant="secondary" tone="muted" style={styles.center}>
            {goalName}
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { borderRadius: radius.card, paddingVertical: space.xxl, paddingHorizontal: space.xl, alignItems: 'center', gap: space.xs, minWidth: 260 },
  emoji: { fontSize: 56, lineHeight: 68 },
  center: { textAlign: 'center' },
});
