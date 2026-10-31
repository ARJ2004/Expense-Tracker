import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../theme';
import { Button, Icon, Text } from '../ui';

export interface UploadDropZoneProps {
  onChoose: () => void;
  loading?: boolean;
  /** Shown under the button when the last pick or upload failed. */
  error?: string | null;
  /** Shown under the button, e.g. "You imported this file on 3 Nov". */
  notice?: string | null;
}

/** The "Upload a bank statement" card (locked Imports mockup). Used on Imports and onboarding. */
export function UploadDropZone({ onChoose, loading = false, error, notice }: UploadDropZoneProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
        <Icon name="upload" color={colors.accentOnSoft} size={26} />
      </View>
      <Text variant="heading">Upload a bank statement</Text>
      <Text variant="secondary" tone="muted" style={styles.center}>
        CSV or XLSX from any bank. PDF support is coming next.
      </Text>
      <Button block label="Choose file" loading={loading} onPress={onChoose} />
      {error ? (
        <Text variant="secondary" tone="spend" style={styles.center} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text variant="secondary" tone="muted" style={styles.center} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: space.lg, borderRadius: radius.card },
  badge: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
