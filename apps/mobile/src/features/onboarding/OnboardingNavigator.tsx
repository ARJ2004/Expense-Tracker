import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountsStep } from './screens/AccountsStep';
import { IncomeStep } from './screens/IncomeStep';
import { SourceStep } from './screens/SourceStep';

export type OnboardingParamList = {
  Income: undefined;
  Accounts: undefined;
  Source: undefined;
};

const Stack = createNativeStackNavigator<OnboardingParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Income" component={IncomeStep} />
      <Stack.Screen name="Accounts" component={AccountsStep} />
      <Stack.Screen name="Source" component={SourceStep} />
    </Stack.Navigator>
  );
}
