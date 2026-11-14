import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { istMonthKey, monthLabel, shiftMonth } from '@et/domain';
import { HeroCard } from '../../../components';
import { errorMessage, type MainStackParamList, type MainTabParamList } from '../../../lib';
import { Button, Card, EmptyState, IconButton, Screen, Text } from '../../../ui';
import { AllowanceCard, useBudgets } from '../../budgets';
import { GoalsOnHome } from '../../goals';
import { useNotifications } from '../../notifications';
import { useRewards } from '../../rewards';
import { RecentTransactions, useOpenAddSheet } from '../../transactions';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { WhereItWent } from '../components/WhereItWent';
import { useDashboardSummary } from '../hooks';
import { heroFigures } from '../summary';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home (mockup 03): the month's hero card, today's allowance, "Where it went", your goals and
 * Recent; arrows step through months, the bell opens the inbox.
 */
export function HomeScreen() {
  const now = new Date();
  const current = istMonthKey(now);
  const [month, setMonth] = useState(current);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const tabs = useNavigation<NavigationProp<MainTabParamList>>();
  const openAdd = useOpenAddSheet();
  const summary = useDashboardSummary(month);
  const budgets = useBudgets();
  const rewards = useRewards();
  const inbox = useNotifications();
  const year = Number(current.slice(0, 4));
  const name = monthLabel(month, year);
  const isCurrent = month === current;
  const data = summary.data;
  const empty = data !== undefined && !data.hasAnyTransactions;

  return (
    <Screen
      eyebrow={greeting(now.getHours())}
      title={`Your ${name}`}
      headerAction={
        <View style={styles.header}>
          {!empty && (
            <MonthSwitcher
              previousLabel={monthLabel(shiftMonth(month, -1), year)}
              nextLabel={monthLabel(shiftMonth(month, 1), year)}
              onPrevious={() => setMonth((m) => shiftMonth(m, -1))}
              onNext={isCurrent ? undefined : () => setMonth((m) => shiftMonth(m, 1))}
            />
          )}
          <IconButton
            icon="bell"
            variant="outlined"
            badge={inbox.data?.unreadCount || undefined}
            accessibilityLabel={inbox.data?.unreadCount ? `Notifications, ${inbox.data.unreadCount} new` : 'Notifications'}
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>
      }
      withTabBar
    >
      {empty && (
        <EmptyState
          title="No transactions yet"
          message="Import a bank statement or add one by hand to see where your money goes."
          actions={[{ label: 'Import a statement', onPress: () => tabs.navigate('Imports') }, { label: 'Add manually', onPress: openAdd }]}
        />
      )}
      {summary.isError && !data && (
        <Card>
          <Text variant="bodyStrong">Couldn't load {name}</Text>
          <Text variant="secondary" tone="muted">
            {errorMessage(summary.error)}
          </Text>
          <Button variant="secondary" label="Try again" onPress={() => summary.refetch()} />
        </Card>
      )}
      {data && !empty && (
        <>
          <HeroCard {...heroFigures(data, isCurrent, name)} />
          {isCurrent && budgets.data && (
            <AllowanceCard
              allowance={budgets.data.allowance}
              streak={rewards.data?.streak.current ?? 0}
              onOpen={() => navigation.navigate('Budgets')}
              onSetUp={() => navigation.navigate('Budgets')}
            />
          )}
          <WhereItWent items={data.byCategory} monthName={name} onSeeAll={() => navigation.navigate('CategorySpend', { month })} />
        </>
      )}
      {isCurrent && (
        <GoalsOnHome
          onOpen={(id) => navigation.navigate('GoalDetail', { id })}
          onSeeAll={() => navigation.navigate('Goals')}
          onNew={() => navigation.navigate('GoalForm')}
        />
      )}
      <RecentTransactions onOpen={(id) => navigation.navigate('TransactionDetail', { id })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
