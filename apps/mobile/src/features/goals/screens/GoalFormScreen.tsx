import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addDays, dailyTarget, daysBetween, formatISTDate, GOAL_LIMITS, istDateKey, toPaise } from '@et/domain';
import { AmountField } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, ChipGroup, Screen, Text, TextField, TopBar } from '../../../ui';
import { useCreateGoal, useGoal, useUpdateGoal } from '../hooks';
import { DEADLINE_OPTIONS, EMOJI_OPTIONS, planLabel } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GoalForm'>;
type Deadline = (typeof DEADLINE_OPTIONS)[number]['value'];

const EMOJI_CHIPS = EMOJI_OPTIONS.map((e) => ({ value: e, label: e }));
const noonIST = (day: string) => new Date(`${day}T12:00:00+05:30`);

/**
 * New goal (or Edit): what it is, what it costs and when it's wanted, with the daily amount
 * worked out as you go. Editing keeps what was saved and spreads the rest over the days left.
 */
export function GoalFormScreen({ navigation, route }: Props) {
  const id = route.params?.id;
  return id ? <EditGoal id={id} navigation={navigation} /> : <GoalForm navigation={navigation} />;
}

function EditGoal({ id, navigation }: { id: string; navigation: Props['navigation'] }) {
  const goal = useGoal(id);
  if (!goal.data) {
    return (
      <Screen>
        <TopBar title="Edit goal" onBack={navigation.goBack} />
      </Screen>
    );
  }
  return <GoalForm navigation={navigation} editing={goal.data} />;
}

interface Editing {
  id: string;
  name: string;
  emoji: string | null;
  targetPaise: number;
  targetDay: string;
  progress: { savedPaise: number };
}

function GoalForm({ navigation, editing }: { navigation: Props['navigation']; editing?: Editing }) {
  const create = useCreateGoal();
  const update = useUpdateGoal(editing?.id ?? '');
  const today = istDateKey(new Date());
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState<string | null>(editing?.emoji ?? null);
  const [digits, setDigits] = useState(editing ? String(Math.trunc(editing.targetPaise / 100)) : '');
  const [deadline, setDeadline] = useState<Deadline | null>(editing ? null : '90');

  const targetDay = deadline ? addDays(today, Number(deadline)) : (editing?.targetDay ?? null);
  const days = targetDay ? daysBetween(today, targetDay) : 0;
  const targetPaise = digits === '' ? 0 : toPaise(digits);
  const left = Math.max(0, targetPaise - (editing?.progress.savedPaise ?? 0));
  const nameOk = name.trim().length >= GOAL_LIMITS.nameLength.min;
  const ready = nameOk && targetPaise >= GOAL_LIMITS.minTargetPaise && days >= 1;
  const pending = create.isPending || update.isPending;

  const save = () => {
    if (!targetDay) return;
    const done = { onSuccess: () => navigation.goBack(), onError: (e: unknown) => Alert.alert('Not saved', errorMessage(e)) };
    const body = { name: name.trim(), targetPaise, targetDay, ...(emoji ? { emoji } : {}) };
    if (editing) update.mutate(body, done);
    else create.mutate(body, done);
  };

  return (
    <Screen footer={<Button block label={editing ? 'Save changes' : 'Start saving'} loading={pending} disabled={!ready} onPress={save} />}>
      <TopBar title={editing ? 'Edit goal' : 'New goal'} onBack={navigation.goBack} />
      <TextField label="What are you saving for?" placeholder="New phone" value={name} onChangeText={setName} maxLength={GOAL_LIMITS.nameLength.max} autoFocus={!editing} />
      <ChipGroup accessibilityLabel="Pick an icon" options={EMOJI_CHIPS} value={emoji} onChange={setEmoji} scroll />
      <Text variant="bodyStrong">What does it cost?</Text>
      <AmountField accessibilityLabel="Goal amount in rupees" value={digits} onChange={setDigits} />
      <Text variant="bodyStrong">When do you want it?</Text>
      <ChipGroup accessibilityLabel="When you want it" options={DEADLINE_OPTIONS} value={deadline} onChange={setDeadline} />
      {editing && !deadline && targetDay && (
        <Text variant="secondary" tone="muted">
          Wanted by {formatISTDate(noonIST(targetDay))}. Pick one above to change it.
        </Text>
      )}
      {ready && targetDay && (
        <Text variant="lead" tone="accent" accessibilityLiveRegion="polite">
          {left === 0 ? 'Already saved in full' : planLabel(dailyTarget(left, days), days, noonIST(targetDay))}
        </Text>
      )}
    </Screen>
  );
}
