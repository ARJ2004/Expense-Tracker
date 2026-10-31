import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AccountsScreen } from '../features/accounts';
import { ImportReviewScreen } from '../features/imports';
import { AddTransactionSheet, TransactionDetailScreen } from '../features/transactions';
import type { MainStackParamList } from '../lib';
import { RootTabs } from './RootTabs';

const Stack = createNativeStackNavigator<MainStackParamList>();

/** Signed-in app: the tabs, screens pushed over them, and the Add sheet available everywhere. */
export function MainNavigator() {
  const navigation = useNavigation<NavigationProp<{ Main: { screen: keyof MainStackParamList; params?: object } }>>();
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={RootTabs} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="ImportReview" component={ImportReviewScreen} />
      </Stack.Navigator>
      <AddTransactionSheet
        onSaved={(txn) => navigation.navigate('Main', { screen: 'TransactionDetail', params: { id: txn.id } })}
      />
    </>
  );
}
