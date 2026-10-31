import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../lib';
import { EmptyState, Screen } from '../../../ui';
import { RecentTransactions, useOpenAddSheet, useRecentTransactions } from '../../transactions';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Home: empty state until the first transaction, then "Recent". Dashboard widgets arrive in Sprint 6. */
export function HomeScreen() {
  const now = new Date();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const openAdd = useOpenAddSheet();
  const recent = useRecentTransactions(5);
  const empty = recent.isSuccess && recent.data.length === 0;
  return (
    <Screen eyebrow={greeting(now.getHours())} title={`Your ${MONTHS[now.getMonth()]}`} withTabBar>
      {empty && (
        <EmptyState
          title="No transactions yet"
          message="Import a bank statement or add one by hand to see where your money goes."
          actions={[{ label: 'Import a statement' }, { label: 'Add manually', onPress: openAdd }]}
        />
      )}
      <RecentTransactions onOpen={(id) => navigation.navigate('TransactionDetail', { id })} />
    </Screen>
  );
}
