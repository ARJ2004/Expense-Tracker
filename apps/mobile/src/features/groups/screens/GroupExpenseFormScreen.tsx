import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { GroupActivity, GroupDetail, GroupSplitMode } from '@et/api-client';
import { GROUP_LIMITS, istDateKey, toPaise, validateExactSplit } from '@et/domain';
import { AmountEntry, AmountKeypad, isPositiveAmount } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, ChipGroup, ListRow, Screen, Text, TextField, TopBar } from '../../../ui';
import { sharePaise, SplitEditor } from '../components/SplitEditor';
import { typedRupees } from '../components/SettleUpSheet';
import { useDeleteExpense, useGroup, useGroupActivity, useSaveExpense } from '../hooks';
import { dateRowLabel, memberName } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GroupExpenseForm'>;
type Nav = Props['navigation'];

/** Add an expense to a group, or edit one: what, how much, when, who paid and who shares it. */
export function GroupExpenseFormScreen({ navigation, route }: Props) {
  const { groupId, expenseId } = route.params;
  const group = useGroup(groupId);
  const activity = useGroupActivity(groupId);
  const editing = expenseId ? activity.data?.pages.flatMap((p) => p.items).find((i) => i.id === expenseId) : undefined;
  if (!group.data || (expenseId && !editing)) {
    return (
      <Screen>
        <TopBar title={expenseId ? 'Edit expense' : 'Add expense'} onBack={navigation.goBack} />
        {(group.isError || activity.isError) && (
          <Text variant="secondary" tone="spend">
            {errorMessage(group.error ?? activity.error)}
          </Text>
        )}
      </Screen>
    );
  }
  return <ExpenseForm group={group.data} editing={editing} navigation={navigation} />;
}

function ExpenseForm({ group, editing, navigation }: { group: GroupDetail; editing?: GroupActivity; navigation: Nav }) {
  const save = useSaveExpense(group.id, editing?.id);
  const remove = useDeleteExpense(group.id);
  const today = istDateKey(new Date());
  const self = group.members.find((m) => m.isSelf);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? typedRupees(editing.amountPaise) : '');
  const [keypad, setKeypad] = useState(!editing);
  const [day, setDay] = useState(editing?.day ?? today);
  const [paidById, setPaidById] = useState(editing?.paidById ?? self?.id ?? '');
  const [mode, setMode] = useState<GroupSplitMode>(editing?.splitMode ?? 'equal');
  const [sharedBy, setSharedBy] = useState<string[]>(editing?.shares?.map((s) => s.memberId) ?? group.members.map((m) => m.id));
  const [exact, setExact] = useState<Record<string, string>>(
    Object.fromEntries((editing?.splitMode === 'exact' ? (editing.shares ?? []) : []).map((s) => [s.memberId, typedRupees(s.sharePaise)])),
  );

  const amountPaise = isPositiveAmount(amount) ? toPaise(amount) : 0;
  const exactShares = group.members.map((m) => ({ memberId: m.id, sharePaise: sharePaise(exact[m.id]) })).filter((s) => s.sharePaise > 0);
  const splitOk = mode === 'equal' ? sharedBy.length > 0 : exactShares.length > 0 && validateExactSplit(amountPaise, exactShares).ok;
  const ready = description.trim().length > 0 && amountPaise > 0 && amountPaise <= GROUP_LIMITS.maxAmountPaise && paidById !== '' && splitOk;

  const pickDay = () =>
    DateTimePickerAndroid.open({
      value: new Date(`${day}T12:00:00+05:30`),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type === 'set' && date) setDay(istDateKey(date));
      },
    });

  const submit = () =>
    save.mutate(
      {
        description: description.trim(),
        amountPaise,
        day,
        paidById,
        splitMode: mode,
        ...(mode === 'equal' ? { memberIds: sharedBy } : { shares: exactShares }),
      },
      { onSuccess: () => navigation.goBack(), onError: (e) => Alert.alert('Not saved', errorMessage(e)) },
    );
  const confirmDelete = () =>
    editing &&
    Alert.alert(`Delete ${editing.description ?? 'this expense'}?`, 'Balances are worked out again without it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(editing.id, { onSuccess: () => navigation.goBack(), onError: (e) => Alert.alert('Not deleted', errorMessage(e)) }) },
    ]);

  const footer = keypad ? (
    <>
      <AmountKeypad value={amount} onChange={setAmount} />
      <Button block label="Done" disabled={!isPositiveAmount(amount)} onPress={() => setKeypad(false)} />
    </>
  ) : (
    <Button block label={editing ? 'Save changes' : 'Save expense'} disabled={!ready} loading={save.isPending} onPress={submit} />
  );

  return (
    <Screen footer={footer}>
      <TopBar title={editing ? 'Edit expense' : 'Add expense'} onBack={navigation.goBack} />
      <Text variant="secondary" tone="muted" style={styles.subtitle}>
        {group.name}
      </Text>
      <TextField label="Description" placeholder="Dinner, cab, tickets…" value={description} onChangeText={setDescription} maxLength={GROUP_LIMITS.descriptionLength.max} />
      <Pressable accessibilityRole="button" accessibilityLabel="Change the amount" onPress={() => setKeypad(true)}>
        <AmountEntry value={amount} />
      </Pressable>
      <ListRow variant="detail" label="Date" value={dateRowLabel(day, today)} onPress={pickDay} />
      {!keypad && (
        <>
          <Text variant="label" tone="muted">
            Paid by
          </Text>
          <ChipGroup scroll accessibilityLabel="Paid by" options={group.members.map((m) => ({ value: m.id, label: memberName(m) }))} value={paidById} onChange={setPaidById} />
          <SplitEditor
            members={group.members}
            amountPaise={amountPaise}
            mode={mode}
            onModeChange={setMode}
            sharedBy={sharedBy}
            onSharedByChange={setSharedBy}
            exact={exact}
            onExactChange={(memberId, rupees) => setExact((e) => ({ ...e, [memberId]: rupees }))}
          />
          {editing && <Button block variant="danger" label="Delete expense" loading={remove.isPending} onPress={confirmDelete} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { textAlign: 'center', marginTop: -12 },
});
