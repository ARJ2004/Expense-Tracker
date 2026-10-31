import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen, useSession } from '../features/auth';
import { OnboardingNavigator } from '../features/onboarding';
import { useTheme } from '../theme';
import { EmptyState, Logo, Screen } from '../ui';
import { RootTabs } from './RootTabs';

export type RootStackParamList = {
  SignIn: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Splash() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={[styles.splash, { backgroundColor: colors.background }]}>
      <Logo size={72} />
    </View>
  );
}

function Offline() {
  const boot = useSession((s) => s.boot);
  return (
    <Screen>
      <EmptyState title="Can't reach Altus" message="Check your connection and try again." actions={[{ label: 'Try again', onPress: () => { boot(); } }]} />
    </Screen>
  );
}

/** Signed out → Sign in; signed in but not onboarded → Onboarding; otherwise the main tabs. */
export function RootNavigator() {
  const status = useSession((s) => s.status);
  const onboarded = useSession((s) => s.user?.onboarded ?? false);
  const boot = useSession((s) => s.boot);

  useEffect(() => {
    boot();
  }, [boot]);

  if (status === 'booting') return <Splash />;
  if (status === 'offline') return <Offline />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {status === 'signedOut' ? (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      ) : onboarded ? (
        <Stack.Screen name="Main" component={RootTabs} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
