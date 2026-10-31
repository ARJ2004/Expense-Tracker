import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space, touchTarget } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface TopBarProps {
  title?: string;
  onBack?: () => void;
  /** Right-hand control, usually an IconButton. */
  action?: ReactNode;
}

/** Back arrow, centred title and an optional action; sides keep the title centred. */
export function TopBar({ title, onBack, action }: TopBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>{onBack && <IconButton icon="back" accessibilityLabel="Back" onPress={onBack} />}</View>
      {title ? (
        <Text variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.side, styles.end]}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget, gap: space.xs },
  side: { width: touchTarget },
  end: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
