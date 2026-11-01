import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { GoalDay } from '@et/api-client';
import { formatISTDate } from '@et/domain';
import { space, useTheme } from '../../../theme';

const SAID: Record<GoalDay['status'], string> = {
  met: 'saved',
  covered: 'missed, but ahead of plan',
  missed: 'missed',
  pending: 'not saved yet',
  none: 'before the goal',
};

/** The last 14 days, oldest first: filled when saved, soft when covered by being ahead. */
export function StreakDots({ days }: { days: readonly GoalDay[] }) {
  const { colors } = useTheme();
  const look: Record<GoalDay['status'], object> = {
    met: { backgroundColor: colors.accent },
    covered: { backgroundColor: colors.accentSoft },
    missed: { backgroundColor: colors.track },
    pending: { borderWidth: 2, borderColor: colors.accent },
    none: { borderWidth: 1, borderColor: colors.border },
  };
  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="Last 14 days">
      {days.map((d) => (
        <View
          key={d.day}
          accessible
          accessibilityLabel={`${formatISTDate(new Date(`${d.day}T12:00:00+05:30`), { year: false })}: ${SAID[d.status]}`}
          style={[styles.dot, look[d.status]]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xxs },
  dot: { flex: 1, aspectRatio: 1, maxWidth: 18, borderRadius: 999 },
});
