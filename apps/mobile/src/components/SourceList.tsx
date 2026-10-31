import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SourceKind } from '@et/api-client';
import { formatISTRelative } from '@et/domain';
import { radius, space, useTheme, type ColorTokens } from '../theme';
import { Card, Icon, Text, type IconName } from '../ui';

export interface SourceListProps {
  sources: ReadonlyArray<{ source: SourceKind; receivedAt: string }>;
}

const LOOK: Record<SourceKind, { label: string; icon: IconName; bg: keyof ColorTokens; fg: keyof ColorTokens }> = {
  manual: { label: 'Added by you', icon: 'edit', bg: 'track', fg: 'text' },
  sms: { label: 'Bank SMS', icon: 'sms', bg: 'accentSoft', fg: 'accentOnSoft' },
  notification: { label: 'Bank app notification', icon: 'sms', bg: 'accentSoft', fg: 'accentOnSoft' },
  statement: { label: 'Bank statement', icon: 'statement', bg: 'warningSoft', fg: 'warningOn' },
};

/** "Seen in N sources": every raw sighting behind one transaction. This is what makes dedup trustworthy. */
export function SourceList({ sources }: SourceListProps) {
  const { colors } = useTheme();
  return (
    <Card>
      <Text variant="bodyStrong" accessibilityRole="header">
        Seen in {sources.length} {sources.length === 1 ? 'source' : 'sources'}
      </Text>
      {sources.map((s, i) => {
        const look = LOOK[s.source];
        return (
          <View key={`${s.source}-${i}`} style={styles.row} accessible>
            <View style={[styles.tile, { backgroundColor: colors[look.bg] as string }]}>
              <Icon name={look.icon} size={18} color={colors[look.fg] as string} />
            </View>
            <View style={styles.text}>
              <Text variant="bodyStrong" style={styles.title}>
                {look.label}
              </Text>
              <Text variant="secondary" tone="muted">
                {formatISTRelative(new Date(s.receivedAt))}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 2, flex: 1 },
  title: { fontSize: 14 },
});
