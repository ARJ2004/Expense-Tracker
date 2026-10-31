import React, { useState } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { istMonthKey, monthLabel, shiftMonth } from '@et/domain';
import { HeroCard } from '../../../components';
import { errorMessage, type MainStackParamList, type MainTabParamList } from '../../../lib';
import { Button, Card, EmptyState, Screen, Text } from '../../../ui';
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

/** Home (mockup 03): the month's hero card, "Where it went" and Recent; arrows step through months. */
export function HomeScreen() {
  const now = new Date();
  const current = istMonthKey(now);
  const [month, setMonth] = useState(current);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const tabs = useNavigation<NavigationProp<MainTabParamList>>();
  const openAdd = useOpenAddSheet();
  const summary = useDashboardSummary(month);
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
        !empty && (
          <MonthSwitcher
            previousLabel={monthLabel(shiftMonth(month, -1), year)}
            nextLabel={monthLabel(shiftMonth(month, 1), year)}
            onPrevious={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={isCurrent ? undefined : () => setMonth((m) => shiftMonth(m, 1))}
          />
        )
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
          <WhereItWent items={data.byCategory} monthName={name} onSeeAll={() => navigation.navigate('CategorySpend', { month })} />
        </>
      )}
      <RecentTransactions onOpen={(id) => navigation.navigate('TransactionDetail', { id })} />
    </Screen>
  );
}
