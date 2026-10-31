import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../theme';

export interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  /** Split into equal pills (onboarding steps); the first round(value × segments) are filled. */
  segments?: number;
  /** "hero" sits on the navy hero card. */
  surface?: 'default' | 'hero';
  accessibilityLabel?: string;
}

/** Track and highlight fill. Height 6 when segmented, 8 otherwise. */
export function ProgressBar({ value, segments, surface = 'default', accessibilityLabel }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  const track = surface === 'hero' ? colors.heroTrack : colors.track;
  const a11y = {
    accessible: true,
    accessibilityRole: 'progressbar' as const,
    accessibilityLabel,
    accessibilityValue: { min: 0, max: 100, now: Math.round(clamped * 100) },
  };
  if (segments) {
    const filled = Math.round(clamped * segments);
    return (
      <View {...a11y} style={styles.segments}>
        {Array.from({ length: segments }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < filled ? colors.highlight : track }]} />
        ))}
      </View>
    );
  }
  return (
    <View {...a11y} style={[styles.bar, { backgroundColor: track }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors.highlight }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 6, borderRadius: radius.pill },
  bar: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
