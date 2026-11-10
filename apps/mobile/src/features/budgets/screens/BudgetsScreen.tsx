import React, { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Budget } from '@et/api-client';
import { CategoryBar, HeroCard } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { useTheme } from '../../../theme';
import { Button, Card, EmptyState, ListRow, SectionLabel, Screen, Text, TopBar } from '../../../ui';
import { useCategories } from '../../categories';
import { useRewards } from '../../rewards';
import { BudgetSheet } from '../components/BudgetSheet';
import { useBudgets } from '../hooks';
import { allowanceBasis, budgetMeta, rupees } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'Budgets'>;

/** Budgets (F10): today's allowance on the navy hero, then each category's budget against its spend. */
export function BudgetsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const budgets = useBudgets();
  const categories = useCategories();
  const rewards = useRewards();
  const [sheet, setSheet] = useState<{ editing: Budget | null } | null>(null);
  const data = budgets.data;
  const allowance = data?.allowance ?? null;

  const available = useMemo(() => {
    const taken = new Set(data?.items.map((b) => b.category.id));
    return (categories.data ?? []).filter((c) => c.isExpense && !taken.has(c.id));
  }, [categories.data, data]);

  const variable = data?.items.filter((b) => !b.isFixed) ?? [];
  const fixed = data?.items.filter((b) => b.isFixed) ?? [];
  const row = (b: Budget) => (
    <CategoryBar
      key={b.category.id}
      name={b.category.name}
      icon={{ name: b.category.icon, color: b.category.color }}
      paise={b.spentPaise}
      ratio={b.amountPaise > 0 ? b.spentPaise / b.amountPaise : 0}
      color={colors.accent}
      state={b.state}
      meta={budgetMeta(b)}
      onPress={() => setSheet({ editing: b })}
    />
  );

  return (
    <Screen footer={!!data?.items.length && available.length > 0 && <Button block label="Add a budget" onPress={() => setSheet({ editing: null })} />}>
      <TopBar title="Budgets" onBack={navigation.goBack} />
      {budgets.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(budgets.error)}
        </Text>
      )}
      {allowance && (
        <HeroCard
          label={allowance.leftTodayPaise < 0 ? 'Over today' : 'Left to spend today'}
          paise={Math.abs(allowance.leftTodayPaise)}
          pill={rewards.data && rewards.data.streak.current > 0 ? `🔥 ${rewards.data.streak.current}-day streak` : undefined}
          progress={allowance.allowancePaise > 0 ? Math.min(1, allowance.spentTodayPaise / allowance.allowancePaise) : 1}
          stats={[
            { label: 'Allowance', paise: allowance.allowancePaise },
            { label: 'Spent today', paise: allowance.spentTodayPaise },
          ]}
        />
      )}
      {allowance && (
        <Text variant="secondary" tone="muted">
          {allowanceBasis(allowance)}
        </Text>
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          title="Give your money a plan"
          message="Set a monthly limit for the categories you want to watch. Mark rent and EMIs as fixed, and Altus works out what you can spend each day."
          actions={[{ label: 'Add a budget', onPress: () => setSheet({ editing: null }) }]}
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <SectionLabel
            label="This month"
            trailing={
              <Text variant="secondary" tone="muted">
                {rupees(data.totalSpentPaise)} of {rupees(data.totalBudgetPaise)}
              </Text>
            }
          />
          {variable.length > 0 && <Card>{variable.map(row)}</Card>}
          {fixed.length > 0 && (
            <>
              <SectionLabel label="Fixed costs" />
              <Card>{fixed.map(row)}</Card>
            </>
          )}
          {data.unbudgetedSpentPaise > 0 && (
            <Card padding="rows">
              <ListRow label="Spent outside budgets" value={rupees(data.unbudgetedSpentPaise)} last />
            </Card>
          )}
        </>
      )}
      <Card padding="rows">
        <ListRow label="Streak and badges" value={rewards.data ? `${rewards.data.badges.filter((b) => b.unlockedAt).length} unlocked` : undefined} onPress={() => navigation.navigate('Rewards')} last />
      </Card>
      <BudgetSheet visible={sheet !== null} onClose={() => setSheet(null)} editing={sheet?.editing ?? null} available={available} />
    </Screen>
  );
}
