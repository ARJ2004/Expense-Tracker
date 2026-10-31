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
}

export function ListRow({ label, value, onPress, tone = 'default', valueTone = 'muted', last = false }: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text variant="bodyStrong" tone={tone === 'danger' ? 'spend' : 'default'}>
        {label}
      </Text>
      <View style={styles.trailing}>
        {value !== undefined && (
          <Text variant="secondary" tone={valueTone}>
            {value}
          </Text>
        )}
        {onPress && <Icon name="chevron" size={18} color={colors.textMuted} />}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
});
