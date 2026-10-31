import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { Category, Direction, TransactionDetail } from '@et/api-client';
import { formatISTRelative, toPaise } from '@et/domain';
import { AmountEntry, AmountKeypad, CategoryIcon, isPositiveAmount } from '../../../components';
import { errorMessage } from '../../../lib';
import { BottomSheet, Button, ChipGroup, ListRow, SegmentedControl, Text } from '../../../ui';
import { accountName, useAccounts } from '../../accounts';
import { useCategories } from '../../categories';
import { useAddSheet } from '../add-sheet';
import { useCreateTransaction, useRecentCategoryIds, useUpdateTransaction } from '../hooks';
import { AccountPicker } from './AccountPicker';
import { FieldRow } from './FieldRow';

const DIRECTIONS = [
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
] as const;

/** Recently picked categories first, then the rest in their usual order. */
function orderCategories(all: readonly Category[], recentIds: readonly string[]): Category[] {
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  return [...all].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
}

export interface AddTransactionSheetProps {
  /** Called with the saved transaction (new or edited). */
  onSaved: (txn: TransactionDetail) => void;
}

/** Locked mockup "Add transaction": Debit/Credit, amount, category chips, account, when, keypad, Save. */
export function AddTransactionSheet({ onSaved }: AddTransactionSheetProps) {
  const draft = useAddSheet();
  const categories = useCategories();
  const recent = useRecentCategoryIds();
  const accounts = useAccounts();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const saving = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const [pickingAccount, setPickingAccount] = useState(false);

  const ordered = useMemo(() => orderCategories(categories.data ?? [], recent.data ?? []), [categories.data, recent.data]);
  const chipOptions = ordered.map((c) => ({ value: c.id, label: c.name, renderIcon: (tint: string) => <CategoryIcon icon={c.icon} tint={tint} /> }));
  const account = accounts.data?.find((a) => a.id === draft.accountId);

  const pickWhen = () => {
    const current = new Date(draft.occurredAt);
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) return;
            const at = new Date(date);
            at.setHours(time.getHours(), time.getMinutes(), 0, 0);
            draft.set({ occurredAt: at.toISOString() });
          },
        });
      },
    });
  };

  const save = () => {
    const common = {
      amountPaise: toPaise(draft.amount),
      direction: draft.direction,
      occurredAt: draft.occurredAt,
      ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
    };
    const done = {
      onSuccess: (txn: TransactionDetail) => {
        draft.close();
        onSaved(txn);
      },
    };
    if (draft.editId) {
      update.mutate(
        { id: draft.editId, body: { ...common, accountId: draft.accountId, merchantName: draft.merchantName, note: draft.note } },
        done,
      );
    } else {
      create.mutate(
        {
          ...common,
          clientRequestId: draft.clientRequestId,
          ...(draft.accountId ? { accountId: draft.accountId } : {}),
          ...(draft.merchantName.trim() ? { merchantName: draft.merchantName } : {}),
          ...(draft.note.trim() ? { note: draft.note } : {}),
        },
        done,
      );
    }
  };

  return (
    <BottomSheet visible={draft.visible} onClose={draft.close} title={draft.editId ? 'Edit transaction' : 'Add transaction'} height="tall">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} style={styles.scroll}>
        <SegmentedControl
          accessibilityLabel="Debit or credit"
          options={DIRECTIONS}
          value={draft.direction}
          onChange={(direction: Direction) => draft.set({ direction })}
        />
        <AmountEntry value={draft.amount} />
        <ChipGroup scroll accessibilityLabel="Category" options={chipOptions} value={draft.categoryId} onChange={(categoryId) => draft.set({ categoryId })} />
        <View>
          <ListRow variant="detail" label="Account" value={account ? accountName(account) : 'No account'} onPress={() => setPickingAccount(true)} />
          <ListRow variant="detail" label="When" value={formatISTRelative(new Date(draft.occurredAt))} onPress={pickWhen} />
          <FieldRow
            label={draft.direction === 'credit' ? 'Received from' : 'Paid to'}
            placeholder="Optional"
            value={draft.merchantName}
            onChangeText={(merchantName) => draft.set({ merchantName })}
            maxLength={80}
          />
          <FieldRow label="Note" placeholder="Optional" value={draft.note} onChangeText={(note) => draft.set({ note })} maxLength={200} last />
        </View>
        <AmountKeypad value={draft.amount} onChange={(amount) => draft.set({ amount })} />
      </ScrollView>
      {error && (
        <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
          {errorMessage(error)}
        </Text>
      )}
      <Button block label="Save" disabled={!isPositiveAmount(draft.amount)} loading={saving} onPress={save} />
      <AccountPicker visible={pickingAccount} value={draft.accountId} onSelect={(accountId) => draft.set({ accountId })} onClose={() => setPickingAccount(false)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: 14 },
});
