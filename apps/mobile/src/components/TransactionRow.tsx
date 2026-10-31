import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TransactionSummary } from '@et/api-client';
import { formatINR, formatISTRelative, formatISTTime } from '@et/domain';
import { space } from '../theme';
import { Text } from '../ui';
import { AmountText } from './AmountText';
import { MerchantAvatar } from './MerchantAvatar';

export interface TransactionRowProps {
  txn: TransactionSummary;
  onPress?: (id: string) => void;
  /** "relative" ("Today, 1:12 pm") on Home; "time" ("1:12 pm") under a day header in the ledger. */
  when?: 'relative' | 'time';
}

/** One ledger line (locked Home "Recent" and Transactions rows): avatar, merchant, "category · when", signed amount. */
export const TransactionRow = memo(function TransactionRowView({ txn, onPress, when: whenStyle = 'relative' }: TransactionRowProps) {
  const title = txn.merchantName ?? txn.category.name;
  const at = new Date(txn.occurredAt);
  const when = whenStyle === 'time' ? formatISTTime(at) : formatISTRelative(at);
  const credit = txn.direction === 'credit';
  const spoken = `${title}, ${credit ? 'received' : 'paid'} ${formatINR(txn.amountPaise)}, ${txn.category.name}, ${when}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={spoken} onPress={onPress && (() => onPress(txn.id))} style={styles.row}>
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
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60 },
  text: { flex: 1, gap: 2 },
});
