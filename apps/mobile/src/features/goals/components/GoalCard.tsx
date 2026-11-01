import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { Goal } from '@et/api-client';
import { errorMessage } from '../../../lib';
import { space } from '../../../theme';
import { Button, Card, ProgressBar, Tag, Text } from '../../../ui';
import { useContribute } from '../hooks';
import { closerLabel, headlineMilestone, rupees, scheduleLabel, streakLabel } from '../labels';
import { Celebration } from './Celebration';

export interface GoalCardProps {
  goal: Goal;
  onOpen: () => void;
}

/**
 * One goal on Home and the Goals list: name, today's amount as one tap, the bar, "12 days closer"
 * and the streak. Saving here celebrates a milestone the same way the goal screen does.
 */
export function GoalCard({ goal, onOpen }: GoalCardProps) {
  const p = goal.progress;
  const contribute = useContribute(goal.id);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const today = p.last14.at(-1)?.status;
  const doneToday = today === 'met';
  const streak = streakLabel(p.streak);
  const saveToday = () =>
    contribute.mutate(
      { amountPaise: p.suggestedTodayPaise },
      { onSuccess: (r) => setCelebrate(headlineMilestone(r.newMilestones)), onError: (e) => Alert.alert('Not saved', errorMessage(e)) },
    );

  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${goal.name}`} onPress={onOpen} style={styles.body}>
        <View style={styles.head}>
          <Text variant="heading" numberOfLines={1} style={styles.name}>
            {goal.emoji ? `${goal.emoji} ` : ''}
            {goal.name}
          </Text>
          {streak && <Tag label={streak} tone="warning" />}
        </View>
        <Text variant="secondary" tone="muted">
          {rupees(p.savedPaise)} of {rupees(goal.targetPaise)} · {scheduleLabel(goal, p)}
        </Text>
        <ProgressBar value={goal.targetPaise > 0 ? p.savedPaise / goal.targetPaise : 0} accessibilityLabel={`${goal.name} saved`} />
        <Text variant="bodyStrong">{closerLabel(p)}</Text>
      </Pressable>
      {goal.status === 'active' &&
        (doneToday ? (
          <Text variant="secondary" tone="accent" accessibilityLiveRegion="polite">
            ✓ Saved {rupees(p.savedTodayPaise)} today
          </Text>
        ) : (
          <Button block label={`Save ${rupees(p.suggestedTodayPaise)} today`} loading={contribute.isPending} onPress={saveToday} />
        ))}
      <Celebration milestone={celebrate} goalName={goal.name} onDone={() => setCelebrate(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  name: { flexShrink: 1 },
});
