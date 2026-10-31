import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateAction {
  label: string;
  onPress?: () => void;
}

export interface EmptyStateProps {
  title: string;
  message: string;
  /** Up to two actions; the first is primary, the second secondary. */
  actions?: [EmptyStateAction] | [EmptyStateAction, EmptyStateAction];
}

export function EmptyState({ title, message, actions }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      <Text variant="secondary" tone="muted" style={styles.center}>
        {message}
      </Text>
      {actions && (
        <View style={styles.actions}>
          {actions.map((action, i) => (
            <Button key={action.label} block label={action.label} onPress={action.onPress} variant={i === 0 ? 'primary' : 'secondary'} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, paddingVertical: space.xxl },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
});
