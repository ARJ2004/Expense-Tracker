import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatISTDateTime } from '@et/domain';
import { AmountText, CategoryPicker, MerchantAvatar, SourceList } from '../../../components';
import { ApiError, errorMessage, type MainStackParamList } from '../../../lib';
import { space, useTheme } from '../../../theme';
import { Button, Card, EmptyState, IconButton, ListRow, Screen, Tag, Text, TopBar } from '../../../ui';
import { accountName } from '../../accounts';
import { useCategories } from '../../categories';
import { useAddSheet } from '../add-sheet';
import { useDeleteTransaction, useTransaction, useUpdateTransaction } from '../hooks';

type Props = NativeStackScreenProps<MainStackParamList, 'TransactionDetail'>;

const TYPE_LABEL: Record<string, string> = {
  expense: 'Expense',
  income: 'Income',
  refund: 'Refund',
  transfer: 'Transfer',
  atm_withdrawal: 'ATM withdrawal',
  cash_deposit: 'Cash deposit',
};

/** Locked mockup "Transaction detail": who, how much, category, facts, every source, actions. */
export function TransactionDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { id } = route.params;
  const txn = useTransaction(id);
  const categories = useCategories();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const openEdit = useAddSheet((s) => s.openEdit);
  const [picking, setPicking] = useState(false);

  if (txn.isPending) {
    return (
      <Screen>
        <TopBar title="Transaction" onBack={navigation.goBack} />
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
      </Screen>
    );
  }
  if (txn.isError) {
    const gone = txn.error instanceof ApiError && txn.error.code === 'NOT_FOUND';
    return (
      <Screen>
        <TopBar title="Transaction" onBack={navigation.goBack} />
        <EmptyState
          title={gone ? 'This transaction is gone' : "Couldn't load this transaction"}
          message={gone ? 'It was deleted.' : errorMessage(txn.error)}
          actions={[{ label: gone ? 'Back' : 'Try again', onPress: gone ? navigation.goBack : () => txn.refetch() }]}
        />
      </Screen>
    );
  }

  const t = txn.data;
  const title = t.merchantName ?? t.category.name;
  const confirmDelete = () =>
    Alert.alert('Delete this transaction?', 'It will no longer count in your totals.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => navigation.goBack(),
            onError: (e) => Alert.alert('Not deleted', errorMessage(e)),
          }),
      },
    ]);

  return (
    <Screen>
      <TopBar title="Transaction" onBack={navigation.goBack} action={<IconButton icon="edit" accessibilityLabel="Edit" onPress={() => openEdit(t)} />} />
      <View style={styles.hero}>
        <MerchantAvatar name={title} size="lg" />
        <Text variant="heading">
          {title}
        </Text>
        <AmountText paise={t.amountPaise} direction={t.direction} variant="hero" decimals="always" />
        <Tag label={t.category.name} />
      </View>
      <Card padding="rows">
        <ListRow variant="detail" label="Account" value={t.account ? accountName(t.account) : 'No account'} />
        <ListRow variant="detail" label="Date" value={formatISTDateTime(new Date(t.occurredAt))} />
        <ListRow variant="detail" label="Type" value={`${t.direction === 'debit' ? 'Debit' : 'Credit'} · ${TYPE_LABEL[t.type] ?? t.type}`} />
        <ListRow variant="detail" label="Note" value={t.note ?? '—'} last />
      </Card>
      <SourceList sources={t.sources} />
      {update.error && (
        <Text variant="secondary" tone="spend">
          {errorMessage(update.error)}
        </Text>
      )}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button block variant="secondary" label="Change category" loading={update.isPending} onPress={() => setPicking(true)} />
        </View>
        <View style={styles.action}>
          <Button block variant="danger" label="Delete" loading={remove.isPending} onPress={confirmDelete} />
        </View>
      </View>
      <CategoryPicker
        visible={picking}
        categories={categories.data ?? []}
        value={t.category.id}
        onClose={() => setPicking(false)}
        onSelect={(categoryId) => {
          setPicking(false);
          if (categoryId !== t.category.id) update.mutate({ id, body: { categoryId } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.xs, paddingTop: space.md, paddingBottom: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
