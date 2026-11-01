import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GoalStatus } from '@et/api-client';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, ChipGroup, EmptyState, Screen, Text, TopBar } from '../../../ui';
import { GoalCard } from '../components/GoalCard';
import { useGoals } from '../hooks';

type Props = NativeStackScreenProps<MainStackParamList, 'Goals'>;

const TABS = [
  { value: 'active', label: 'Saving' },
  { value: 'reached', label: 'Reached' },
  { value: 'archived', label: 'Archived' },
] as const satisfies ReadonlyArray<{ value: GoalStatus; label: string }>;

/** Every goal, by status, soonest deadline first. */
export function GoalsScreen({ navigation }: Props) {
  const [status, setStatus] = useState<GoalStatus>('active');
  const goals = useGoals(status);
  const open = (id: string) => navigation.navigate('GoalDetail', { id });
  const add = () => navigation.navigate('GoalForm');

  return (
    <Screen footer={status === 'active' && !!goals.data?.length && <Button block label="New goal" onPress={add} />}>
      <TopBar title="Goals" onBack={navigation.goBack} />
      <ChipGroup accessibilityLabel="Show goals" options={TABS} value={status} onChange={setStatus} />
      {goals.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(goals.error)}
        </Text>
      )}
      {goals.data?.length === 0 &&
        (status === 'active' ? (
          <EmptyState
            title="Save for something you want"
            message="Pick what it is, what it costs and when you want it. Altus works out how much to put aside each day."
            actions={[{ label: 'Set a goal', onPress: add }]}
          />
        ) : (
          <Text variant="secondary" tone="muted">
            {status === 'reached' ? 'Goals you reach show up here.' : 'Archived goals show up here.'}
          </Text>
        ))}
      {goals.data?.map((g) => <GoalCard key={g.id} goal={g} onOpen={() => open(g.id)} />)}
    </Screen>
  );
}
