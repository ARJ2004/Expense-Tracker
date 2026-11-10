import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Budget, Category } from '@et/api-client';
import { toPaise } from '@et/domain';
import { AmountField, CategoryIcon, CategoryPicker } from '../../../components';
import { errorMessage } from '../../../lib';
import { space } from '../../../theme';
import { BottomSheet, Button, ListRow, Text, Toggle } from '../../../ui';
import { useDeleteBudget, useSetBudget } from '../hooks';

export interface BudgetSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Editing this budget; null adds a new one. */
  editing: Budget | null;
  /** Spending categories without a budget yet (for a new one). */
  available: readonly Category[];
}

/** Add or change a category's monthly budget, mark it fixed, or remove it. */
export function BudgetSheet({ visible, onClose, editing, available }: BudgetSheetProps) {
  const save = useSetBudget();
  const remove = useDeleteBudget();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [digits, setDigits] = useState('');
  const [fixed, setFixed] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCategoryId(editing?.category.id ?? null);
    setDigits(editing ? String(Math.trunc(editing.amountPaise / 100)) : '');
    setFixed(editing?.isFixed ?? false);
  }, [visible, editing]);

  const category = editing?.category ?? available.find((c) => c.id === categoryId) ?? null;
  const amountPaise = digits === '' ? 0 : toPaise(digits);
  const canSave = category !== null && amountPaise >= 100 && !save.isPending;

  const submit = () =>
    category &&
    save.mutate(
      { categoryId: category.id, body: { amountPaise, isFixed: fixed } },
      { onSuccess: onClose, onError: (e) => Alert.alert('Couldn’t save the budget', errorMessage(e)) },
    );
  const drop = () =>
    editing &&
    remove.mutate(editing.category.id, { onSuccess: onClose, onError: (e) => Alert.alert('Couldn’t remove the budget', errorMessage(e)) });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={editing ? editing.category.name : 'New budget'}>
      <View style={styles.body}>
        {!editing && (
          <View style={styles.category}>
            {category && <CategoryIcon icon={category.icon} color={category.color} size={18} />}
            <View style={styles.grow}>
              <ListRow label="Category" value={category?.name ?? 'Choose'} onPress={() => setPicking(true)} last />
            </View>
          </View>
        )}
        <Text variant="secondary" tone="muted">
          Monthly limit
        </Text>
        <AmountField value={digits} onChange={setDigits} accessibilityLabel="Monthly limit in rupees" autoFocus={!!editing} />
        <Toggle label="Fixed cost" hint="Rent, EMIs, fees: held back in full from your daily allowance" value={fixed} onValueChange={setFixed} />
        <Button block label={save.isPending ? 'Saving…' : 'Save budget'} onPress={submit} disabled={!canSave} />
        {editing && <Button block variant="danger" label={remove.isPending ? 'Removing…' : 'Remove budget'} onPress={drop} />}
      </View>
      <CategoryPicker
        visible={picking}
        categories={available}
        value={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm },
  category: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
});
