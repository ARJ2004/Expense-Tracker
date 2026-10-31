import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AccountsScreen } from '../features/accounts';
import { CategorySpendScreen } from '../features/home';
import { ImportReviewScreen } from '../features/imports';
import { CategoriesScreen, DeleteAccountScreen, IncomeScreen } from '../features/settings';
import { useSession } from '../features/auth';
import { SmsCaptureScreen, useSmsCapture } from '../features/sms';
import { AddTransactionSheet, TransactionDetailScreen } from '../features/transactions';
import type { MainStackParamList } from '../lib';
import { RootTabs } from './RootTabs';

const Stack = createNativeStackNavigator<MainStackParamList>();

/** Signed-in app: the tabs, screens pushed over them, and the Add sheet available everywhere. */
export function MainNavigator() {
  const navigation = useNavigation<NavigationProp<{ Main: { screen: keyof MainStackParamList; params?: object } }>>();
  const userId = useSession((s) => s.user?.id);
  const claimSms = useSmsCapture((s) => s.claim);
  // SMS capture state on this phone belongs to one user; a different sign-in starts with it off.
  useEffect(() => {
    if (userId) claimSms(userId);
  }, [userId, claimSms]);
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={RootTabs} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="ImportReview" component={ImportReviewScreen} />
        <Stack.Screen name="SmsCapture" component={SmsCaptureScreen} />
        <Stack.Screen name="CategorySpend" component={CategorySpendScreen} />
        <Stack.Screen name="Categories" component={CategoriesScreen} />
        <Stack.Screen name="Income" component={IncomeScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      </Stack.Navigator>
      <AddTransactionSheet
        onSaved={(txn) => navigation.navigate('Main', { screen: 'TransactionDetail', params: { id: txn.id } })}
      />
    </>
  );
}
