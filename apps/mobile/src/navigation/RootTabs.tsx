import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../features/home';
import { ImportsScreen } from '../features/imports';
import { SettingsScreen } from '../features/settings';
import { TransactionsScreen } from '../features/transactions';
import { TabBar } from '../ui';

export type RootTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Add: undefined;
  Imports: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

/** The Add tab never navigates; it will open the Add transaction sheet in Sprint 3. */
function AddPlaceholder() {
  return <View />;
}

function renderTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} />;
}

export function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen
        name="Add"
        component={AddPlaceholder}
        options={{ tabBarAccessibilityLabel: 'Add transaction' }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tab.Screen name="Imports" component={ImportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
