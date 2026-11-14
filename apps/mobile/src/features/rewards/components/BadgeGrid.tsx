import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Badge } from '@et/api-client';
import { formatISTDate } from '@et/domain';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui';

/** Badges two to a row: unlocked ones in colour with the date, locked ones faded with how to earn them. */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {badges.map((b) => {
        const on = b.unlockedAt !== null;
        return (
          <View
            key={b.code}
            accessible
            accessibilityLabel={`${b.title}, ${on ? `unlocked ${formatISTDate(new Date(b.unlockedAt!))}` : `locked: ${b.description}`}`}
            style={[styles.badge, { backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: on ? colors.accentSoft : colors.border }]}
          >
            <Text style={[styles.emoji, !on && styles.locked]}>{b.emoji}</Text>
            <Text variant="bodyStrong" numberOfLines={1} style={on ? { color: colors.accentOnSoft } : undefined} tone={on ? 'default' : 'muted'}>
              {b.title}
            </Text>
            <Text variant="secondary" tone="muted" numberOfLines={2}>
              {on ? formatISTDate(new Date(b.unlockedAt!)) : b.description}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { width: '47%', flexGrow: 1, borderRadius: radius.md, borderWidth: 1, padding: space.sm, gap: 2 },
  emoji: { fontSize: 28, lineHeight: 36 },
  locked: { opacity: 0.35 },
});
