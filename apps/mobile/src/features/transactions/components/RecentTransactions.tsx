import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TransactionRow } from '../../../components';
import { space } from '../../../theme';
import { Text } from '../../../ui';
import { useRecentTransactions } from '../hooks';

export interface RecentTransactionsProps {
  onOpen: (id: string) => void;
}

/** Home's "Recent" list (locked mockup). Renders nothing until there is at least one transaction. */
export function RecentTransactions({ onOpen }: RecentTransactionsProps) {
  const recent = useRecentTransactions(5);
  const items = recent.data ?? [];
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text variant="heading" accessibilityRole="header" style={styles.heading}>
        Recent
      </Text>
      {items.map((t) => (
        <TransactionRow key={t.id} txn={t} onPress={() => onOpen(t.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  heading: { marginBottom: space.xxs },
});
