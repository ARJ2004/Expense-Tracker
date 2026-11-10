import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatISTDate } from '@et/domain';
import { space, useTheme } from '../theme';

/** done: filled; soft: done another way (ahead of plan); missed: empty track; pending: today, open; none: no record. */
export type DayDotLook = 'done' | 'soft' | 'missed' | 'pending' | 'none';

export interface DayDot {
  /** IST day, "YYYY-MM-DD". */
  day: string;
  look: DayDotLook;
  /** Read out after the date, e.g. "saved" or "within allowance". */
  said: string;
}

/**
 * A row of day dots, oldest first: a goal's saving days, or the days within the daily allowance.
 * Shared by goals and rewards.
 */
export function DayDots({ days, label }: { days: readonly DayDot[]; label: string }) {
  const { colors } = useTheme();
  const look: Record<DayDotLook, object> = {
    done: { backgroundColor: colors.accent },
    soft: { backgroundColor: colors.accentSoft },
    missed: { backgroundColor: colors.track },
    pending: { borderWidth: 2, borderColor: colors.accent },
    none: { borderWidth: 1, borderColor: colors.border },
  };
  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel={label}>
      {days.map((d) => (
        <View
          key={d.day}
          accessible
          accessibilityLabel={`${formatISTDate(new Date(`${d.day}T12:00:00+05:30`), { year: false })}: ${d.said}`}
          style={[styles.dot, look[d.look]]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xxs },
  dot: { flex: 1, aspectRatio: 1, maxWidth: 18, borderRadius: 999 },
});
