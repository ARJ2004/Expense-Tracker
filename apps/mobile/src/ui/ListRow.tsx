import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { space, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  label: string;
  value?: string;
  /** Show a chevron and make the row pressable. */
  onPress?: () => void;
  tone?: 'default' | 'danger';
  valueTone?: 'muted' | 'default' | 'spend' | 'accent';
  /** Hide the divider under the last row of a card. */
  last?: boolean;
  /** "detail": muted label, bold value (Detail and Add sheet rows). "default": bold label, muted value (Settings). */
  variant?: 'default' | 'detail';
}

export function ListRow({ label, value, onPress, tone = 'default', valueTone, last = false, variant = 'default' }: ListRowProps) {
  const { colors } = useTheme();
  const detail = variant === 'detail';
  const content = (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text variant={detail ? 'body' : 'bodyStrong'} tone={tone === 'danger' ? 'spend' : detail ? 'muted' : 'default'}>
        {label}
      </Text>
      <View style={styles.trailing}>
        {value !== undefined && (
          <Text variant={detail ? 'bodyStrong' : 'secondary'} tone={valueTone ?? (detail ? 'default' : 'muted')} numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        )}
        {onPress && <Icon name="chevron" size={18} color={colors.textMuted} />}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, flexShrink: 1 },
  value: { flexShrink: 1, textAlign: 'right' },
});
