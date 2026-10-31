import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../lib';
import { Card, ListRow, Screen } from '../../../ui';
import { useSession, useSignOut } from '../../auth';
import { useHealth } from '../hooks';
import appInfo from '../../../../app.json';

/** Settings: account, sign out, accounts list; export and delete account arrive with F8. */
export function SettingsScreen() {
  const health = useHealth();
  const email = useSession((s) => s.user?.email);
  const signOut = useSignOut();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const apiValue = health.isPending
    ? 'Checking…'
    : health.isError
      ? 'Unreachable'
      : `ok · v${health.data.version}`;
  return (
    <Screen title="Settings" withTabBar>
      <Card padding="rows">
        <ListRow label="Signed in as" value={email ?? '—'} />
        <ListRow label={signOut.isPending ? 'Signing out…' : 'Sign out'} tone="danger" onPress={() => signOut.mutate()} last />
      </Card>
      <Card padding="rows">
        <ListRow label="Accounts" onPress={() => navigation.navigate('Accounts')} last />
      </Card>
      <Card padding="rows">
        <ListRow label="API" value={apiValue} valueTone={health.isError ? 'spend' : 'muted'} />
        <ListRow label="App" value={`${appInfo.displayName} · ${__DEV__ ? 'debug' : 'release'}`} last />
      </Card>
    </Screen>
  );
}
