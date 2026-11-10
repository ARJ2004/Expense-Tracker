import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AccountsScreen } from '../features/accounts';
import { BudgetsScreen } from '../features/budgets';
import { GoalDetailScreen, GoalFormScreen, GoalsScreen } from '../features/goals';
import { CategorySpendScreen } from '../features/home';
import { ImportReviewScreen } from '../features/imports';
import { NotificationSettingsScreen, NotificationsScreen, openNotificationTarget, usePushRegistration } from '../features/notifications';
import { RewardsScreen } from '../features/rewards';
import { CategoriesScreen, DeleteAccountScreen, IncomeScreen } from '../features/settings';
import { DataSourcesScreen, useSmsForegroundSync } from '../features/sms';
import { AddTransactionSheet, TransactionDetailScreen } from '../features/transactions';
import type { MainStackParamList } from '../lib';
import { RootTabs } from './RootTabs';

const Stack = createNativeStackNavigator<MainStackParamList>();

/** Signed-in app: the tabs, screens pushed over them, and the Add sheet available everywhere. */
export function MainNavigator() {
  const navigation = useNavigation<NavigationProp<{ Main: { screen: keyof MainStackParamList; params?: object } }>>();
  // SMS capture on this phone belongs to one user; the sms store claims it at sign-in.
  useSmsForegroundSync();
  // A tapped push opens its screen inside this stack.
  usePushRegistration((data) =>
    openNotificationTarget({ navigate: ((screen: keyof MainStackParamList, params?: object) => navigation.navigate('Main', { screen, params })) as never }, data),
  );
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={RootTabs} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="ImportReview" component={ImportReviewScreen} />
        <Stack.Screen name="DataSources" component={DataSourcesScreen} />
        <Stack.Screen name="CategorySpend" component={CategorySpendScreen} />
        <Stack.Screen name="Categories" component={CategoriesScreen} />
        <Stack.Screen name="Income" component={IncomeScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="Goals" component={GoalsScreen} />
        <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
        <Stack.Screen name="GoalForm" component={GoalFormScreen} />
        <Stack.Screen name="Budgets" component={BudgetsScreen} />
        <Stack.Screen name="Rewards" component={RewardsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      </Stack.Navigator>
      <AddTransactionSheet
        onSaved={(txn) => navigation.navigate('Main', { screen: 'TransactionDetail', params: { id: txn.id } })}
      />
    </>
  );
}
