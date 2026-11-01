import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen, useSession } from '../features/auth';
import { OnboardingNavigator } from '../features/onboarding';
import { useTheme } from '../theme';
import { EmptyState, Logo, Screen } from '../ui';
import { LaunchScreen } from './LaunchScreen';
import { MainNavigator } from './MainNavigator';

export type RootStackParamList = {
  SignIn: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Shown when "Try again" boots again after the launch screen has gone. */
function Booting() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={[styles.booting, { backgroundColor: colors.background }]}>
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

/**
 * Signed out → Sign in; signed in but not onboarded → Onboarding; otherwise the main tabs.
 * The launch screen covers the first boot and fades out over whichever of these comes first.
 */
export function RootNavigator() {
  const [launched, setLaunched] = useState(false);
  const onLaunched = useCallback(() => setLaunched(true), []);
  const status = useSession((s) => s.status);
  const boot = useSession((s) => s.boot);

  useEffect(() => {
    boot();
  }, [boot]);

  return (
    <View style={styles.root}>
      {status === 'booting' && !launched ? null : <Routes />}
      {launched ? null : <LaunchScreen ready={status !== 'booting'} onDone={onLaunched} />}
    </View>
  );
}

function Routes() {
  const status = useSession((s) => s.status);
  const onboarded = useSession((s) => s.user?.onboarded ?? false);

  if (status === 'booting') return <Booting />;
  if (status === 'offline') return <Offline />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {status === 'signedOut' ? (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      ) : onboarded ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  booting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
