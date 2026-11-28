import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { GroupActivity, GroupDetail, GroupSplitMode } from '@et/api-client';
import { GROUP_LIMITS, istDateKey, toPaise, validateExactSplit } from '@et/domain';
import { AmountEntry, AmountKeypad, isPositiveAmount } from '../../../components';
import { ApiError, errorMessage, newUuid, type MainStackParamList } from '../../../lib';
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
  // A newer version from someone else remounts the form with their values.
  return <ExpenseForm key={editing?.version ?? 'new'} group={group.data} editing={editing} navigation={navigation} onStale={() => activity.refetch()} />;
}

interface ExpenseFormProps {
  group: GroupDetail;
  editing?: GroupActivity;
  navigation: Nav;
  /** Someone else changed or deleted it: reload. */
  onStale: () => void;
}

function ExpenseForm({ group, editing, navigation, onStale }: ExpenseFormProps) {
  const save = useSaveExpense(group.id, editing?.id);
  const remove = useDeleteExpense(group.id);
  const today = istDateKey(new Date());
  // One id per new expense, kept across retries, so a flaky network never adds it twice.
  const [clientRequestId] = useState(newUuid);
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
        ...(editing ? { version: editing.version } : { clientRequestId }),
      },
      { onSuccess: () => navigation.goBack(), onError: stale('Not saved') },
    );
  /** 409: someone saved first; 404: someone deleted it. Never overwrite either silently. */
  const stale = (title: string) => (e: unknown) => {
    if (e instanceof ApiError && e.code === 'GROUP_EXPENSE_CHANGED') {
      Alert.alert('Changed by someone else', 'Someone saved this expense just now. Their version is loaded; check it and make your change again.');
      onStale();
    } else if (e instanceof ApiError && e.code === 'NOT_FOUND') {
      Alert.alert('Expense deleted', 'Someone deleted this expense.');
      navigation.goBack();
    } else {
      Alert.alert(title, errorMessage(e));
    }
  };
  const confirmDelete = () =>
    editing &&
    Alert.alert(`Delete ${editing.description ?? 'this expense'}?`, 'Balances are worked out again without it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate({ expenseId: editing.id, version: editing.version }, { onSuccess: () => navigation.goBack(), onError: stale('Not deleted') }),
      },
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
