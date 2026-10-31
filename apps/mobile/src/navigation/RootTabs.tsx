import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../features/home';
import { ImportsScreen } from '../features/imports';
import { SettingsScreen } from '../features/settings';
import { useAccounts } from '../features/accounts';
import { TransactionsScreen, useOpenAddSheet } from '../features/transactions';
import type { MainTabParamList } from '../lib';
import { TabBar } from '../ui';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** The Add tab never navigates; pressing it opens the Add transaction sheet. */
function AddPlaceholder() {
  return <View />;
}

function renderTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} />;
}

export function RootTabs() {
  const openAdd = useOpenAddSheet();
  // Keeps the accounts list cached so the Add sheet can pre-select one.
  useAccounts();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen
        name="Add"
        component={AddPlaceholder}
        options={{ tabBarAccessibilityLabel: 'Add transaction' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            openAdd();
          },
        }}
      />
      <Tab.Screen name="Imports" component={ImportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
