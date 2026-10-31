import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TransactionSummary } from '@et/api-client';
import { formatINR, formatISTRelative } from '@et/domain';
import { space } from '../theme';
import { Text } from '../ui';
import { AmountText } from './AmountText';
import { MerchantAvatar } from './MerchantAvatar';

export interface TransactionRowProps {
  txn: TransactionSummary;
  onPress?: () => void;
}

/** One ledger line (locked Home "Recent" row): avatar, merchant, "category · when", signed amount. */
export function TransactionRow({ txn, onPress }: TransactionRowProps) {
  const title = txn.merchantName ?? txn.category.name;
  const when = formatISTRelative(new Date(txn.occurredAt));
  const credit = txn.direction === 'credit';
  const spoken = `${title}, ${credit ? 'received' : 'paid'} ${formatINR(txn.amountPaise)}, ${txn.category.name}, ${when}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={spoken} onPress={onPress} style={styles.row}>
      <MerchantAvatar name={title} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="secondary" tone="muted" numberOfLines={1}>
          {txn.category.name} · {when}
        </Text>
      </View>
      <AmountText paise={txn.amountPaise} direction={txn.direction} tone={credit ? 'income' : 'default'} decimals="always" symbol={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 },
  text: { flex: 1, gap: 2 },
});
