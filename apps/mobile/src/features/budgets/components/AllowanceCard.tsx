import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Allowance } from '@et/api-client';
import { space } from '../../../theme';
import { Button, Card, ProgressBar, Text } from '../../../ui';
import { allowanceLine, rupees } from '../labels';

export interface AllowanceCardProps {
  allowance: Allowance | null;
  /** Under-budget days in a row; shown from 1. */
  streak: number;
  onOpen: () => void;
  onSetUp: () => void;
}

/** Home's "today" card: what's left of today's allowance, with the streak; or an invitation to set a budget. */
export function AllowanceCard({ allowance, streak, onOpen, onSetUp }: AllowanceCardProps) {
  if (!allowance) {
    return (
      <Card>
        <Text variant="heading">Know what you can spend today</Text>
        <Text variant="secondary" tone="muted">
          Add your income or a budget and Altus works out a daily allowance, with a streak for every day you stay within it.
        </Text>
        <Button block variant="secondary" label="Set a budget" onPress={onSetUp} />
      </Card>
    );
  }
  const over = allowance.leftTodayPaise < 0;
  const used = allowance.allowancePaise > 0 ? allowance.spentTodayPaise / allowance.allowancePaise : 1;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Today: ${rupees(allowance.leftTodayPaise)} ${over ? 'over' : 'left'}. Open budgets`} onPress={onOpen}>
      <Card>
        <View style={styles.top}>
          <Text variant="eyebrow" tone="muted">
            {over ? 'Over today' : 'Left to spend today'}
          </Text>
          {streak > 0 && <Text variant="label">🔥 {streak}-day streak</Text>}
        </View>
        <Text variant="title" tone={over ? 'spend' : 'default'}>
          {rupees(allowance.leftTodayPaise)}
        </Text>
        <ProgressBar value={Math.min(1, used)} accessibilityLabel="Today's allowance used" />
        <Text variant="secondary" tone="muted">
          {allowanceLine(allowance)}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
