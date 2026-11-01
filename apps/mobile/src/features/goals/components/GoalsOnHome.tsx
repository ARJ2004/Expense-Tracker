import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { space } from '../../../theme';
import { Button, Card, Text } from '../../../ui';
import { useGoals } from '../hooks';
import { GoalCard } from './GoalCard';

const ON_HOME = 2;

export interface GoalsOnHomeProps {
  onOpen: (id: string) => void;
  onSeeAll: () => void;
  onNew: () => void;
}

/** Home's "Your goals": the two nearest deadlines with a one-tap save, or an invitation to start. */
export function GoalsOnHome({ onOpen, onSeeAll, onNew }: GoalsOnHomeProps) {
  const goals = useGoals('active');
  if (!goals.data) return null;
  if (goals.data.length === 0) {
    return (
      <Card>
        <Text variant="heading">Saving for something?</Text>
        <Text variant="secondary" tone="muted">
          Set a goal and Altus tells you how much to put aside each day, with a streak for every day you do.
        </Text>
        <Button block variant="secondary" label="Set a goal" onPress={onNew} />
      </Card>
    );
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="heading" accessibilityRole="header">
          Your goals
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all goals" onPress={onSeeAll} hitSlop={12}>
          <Text variant="bodyStrong" tone="accent">
            See all
          </Text>
        </Pressable>
      </View>
      {goals.data.slice(0, ON_HOME).map((g) => (
        <GoalCard key={g.id} goal={g} onOpen={() => onOpen(g.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
