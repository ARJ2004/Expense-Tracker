import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../theme';
import { Button, Icon, Text, TopBar, type IconName } from '../ui';

export interface PermissionExplainerProps {
  icon: IconName;
  title: string;
  /** What the app does with the access, one point per line. */
  points: readonly string[];
  /** What it never does; shown in a box so it can't be missed. */
  never: string;
  allowLabel: string;
  onAllow: () => void;
  onDecline: () => void;
  declineLabel?: string;
  loading?: boolean;
  /** Shown above the buttons, e.g. "Allow SMS in Android settings". */
  error?: string | null;
  onBack?: () => void;
}

/**
 * The full-screen disclosure shown before any Android permission prompt (Play Store prominent
 * disclosure). Used for SMS now and the notification listener later. Allow is the only path to
 * the system prompt.
 */
export function PermissionExplainer({
  icon,
  title,
  points,
  never,
  allowLabel,
  onAllow,
  onDecline,
  declineLabel = 'Not now',
  loading = false,
  error,
  onBack,
}: PermissionExplainerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.fill}>
      {onBack && <TopBar onBack={onBack} />}
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
          <Icon name={icon} color={colors.accentOnSoft} size={28} />
        </View>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.points}>
          {points.map((p) => (
            <View key={p} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text variant="body" style={styles.pointText}>
                {p}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.never, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="secondary" tone="muted">
            {never}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        {error ? (
          <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button block label={allowLabel} loading={loading} onPress={onAllow} />
        <Button block variant="text" label={declineLabel} onPress={onDecline} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: space.md },
  body: { flex: 1, gap: space.md },
  badge: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  points: { gap: space.sm },
  point: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: radius.pill, marginTop: 8 },
  pointText: { flex: 1 },
  never: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  footer: { gap: space.xs },
});
