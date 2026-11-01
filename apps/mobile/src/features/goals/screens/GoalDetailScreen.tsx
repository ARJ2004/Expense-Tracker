import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatISTDate, toPaise } from '@et/domain';
import { AmountField, HeroCard } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { space } from '../../../theme';
import { Button, Card, IconButton, ListRow, SectionLabel, Text, Screen, Toggle, TopBar } from '../../../ui';
import { Celebration } from '../components/Celebration';
import { StreakDots } from '../components/StreakDots';
import { useContribute, useDeleteGoal, useGoal, useRemoveContribution, useUpdateGoal } from '../hooks';
import { closerLabel, headlineMilestone, rupees, scheduleLabel } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GoalDetail'>;

const dayLabel = (day: string) => formatISTDate(new Date(`${day}T12:00:00+05:30`), { year: false });

/**
 * One goal: how much is saved, the streak and the last 14 days, today's amount as one tap (or
 * another amount, for today or yesterday), what was put aside, and archive or delete.
 */
export function GoalDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const goal = useGoal(id);
  const contribute = useContribute(id);
  const takeBack = useRemoveContribution(id);
  const update = useUpdateGoal(id);
  const remove = useDeleteGoal(id);
  const [other, setOther] = useState(false);
  const [digits, setDigits] = useState('');
  const [yesterday, setYesterday] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const g = goal.data;
  if (!g) {
    return (
      <Screen>
        <TopBar onBack={navigation.goBack} />
        {goal.isError && (
          <Text variant="secondary" tone="spend">
            {errorMessage(goal.error)}
          </Text>
        )}
      </Screen>
    );
  }
  const p = g.progress;
  const active = g.status === 'active';
  const doneToday = p.last14.at(-1)?.status === 'met';

  const save = (amountPaise: number) =>
    contribute.mutate(
      { amountPaise, ...(yesterday ? { day: 'yesterday' as const } : {}) },
      {
        onSuccess: (r) => {
          setOther(false);
          setDigits('');
          setYesterday(false);
          setCelebrate(headlineMilestone(r.newMilestones));
        },
        onError: (e) => Alert.alert('Not saved', errorMessage(e)),
      },
    );
  const confirmTakeBack = (contributionId: string, amountPaise: number, day: string) =>
    Alert.alert(`Take back ${rupees(amountPaise)}?`, `Saved on ${dayLabel(day)}. Your streak and progress are worked out again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take back', style: 'destructive', onPress: () => takeBack.mutate(contributionId, { onError: (e) => Alert.alert('Not changed', errorMessage(e)) }) },
    ]);
  const confirmDelete = () =>
    Alert.alert(`Delete ${g.name}?`, 'The goal and everything put aside for it are removed. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(undefined, { onSuccess: () => navigation.goBack(), onError: (e) => Alert.alert('Not deleted', errorMessage(e)) }) },
    ]);

  return (
    <Screen>
      <TopBar
        title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`}
        onBack={navigation.goBack}
        action={g.status !== 'reached' && <IconButton icon="edit" accessibilityLabel="Edit goal" onPress={() => navigation.navigate('GoalForm', { id })} />}
      />
      <HeroCard
        label="Saved so far"
        paise={p.savedPaise}
        pill={`${Math.floor((p.savedPaise * 100) / g.targetPaise)}%`}
        progress={p.savedPaise / g.targetPaise}
        stats={[
          { label: 'To go', paise: p.remainingPaise },
          { label: 'A day', paise: p.dailyTargetPaise, tone: 'income' },
        ]}
      />

      <Card>
        <View style={styles.row}>
          <Text variant="lead">{p.streak > 0 ? `🔥 ${p.streak}-day streak` : 'No streak yet'}</Text>
          <Text variant="secondary" tone="muted">
            Best {p.bestStreak}
          </Text>
        </View>
        <Text variant="bodyStrong">{closerLabel(p)}</Text>
        <Text variant="secondary" tone={p.scheduleDelta < 0 || p.overdue ? 'spend' : 'muted'}>
          {scheduleLabel(g, p)} · wanted by {formatISTDate(new Date(`${g.targetDay}T12:00:00+05:30`))}
        </Text>
        <StreakDots days={p.last14} />
      </Card>

      {active && (
        <Card>
          {doneToday && !other ? (
            <Text variant="bodyStrong" tone="accent">
              ✓ {rupees(p.savedTodayPaise)} saved today. Come back tomorrow to keep the streak.
            </Text>
          ) : (
            !other && <Button block label={`Save ${rupees(p.suggestedTodayPaise)} today`} loading={contribute.isPending} onPress={() => save(p.suggestedTodayPaise)} />
          )}
          {other ? (
            <>
              <AmountField accessibilityLabel="Amount put aside in rupees" value={digits} onChange={setDigits} autoFocus />
              <Toggle label="This was yesterday" value={yesterday} onValueChange={setYesterday} />
              <Button block label="Save" loading={contribute.isPending} disabled={digits === '' || toPaise(digits) <= 0} onPress={() => save(toPaise(digits))} />
              <Button variant="text" label="Cancel" onPress={() => setOther(false)} />
            </>
          ) : (
            <Button variant="text" label="Another amount" onPress={() => setOther(true)} />
          )}
        </Card>
      )}

      {g.contributions.length > 0 && (
        <>
          <SectionLabel label="Put aside" />
          <Card padding="rows">
            {g.contributions.map((c, i) => (
              <ListRow
                key={c.id}
                label={dayLabel(c.day)}
                value={rupees(c.amountPaise)}
                variant="detail"
                onPress={() => confirmTakeBack(c.id, c.amountPaise, c.day)}
                last={i === g.contributions.length - 1}
              />
            ))}
          </Card>
        </>
      )}

      <Card padding="rows">
        {g.status === 'archived' ? (
          <ListRow label="Bring back" onPress={() => update.mutate({ status: 'active' })} />
        ) : (
          <ListRow label="Archive" onPress={() => update.mutate({ status: 'archived' }, { onSuccess: () => navigation.goBack() })} />
        )}
        <ListRow label="Delete goal" tone="danger" onPress={confirmDelete} last />
      </Card>

      <Celebration milestone={celebrate} goalName={g.name} onDone={() => setCelebrate(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.xs },
});
