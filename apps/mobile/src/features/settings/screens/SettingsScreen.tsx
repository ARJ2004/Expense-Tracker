import React from 'react';
import { Card, ListRow, Screen } from '../../../ui';
import { useSession, useSignOut } from '../../auth';
import { useHealth } from '../hooks';
import appInfo from '../../../../app.json';

/** Settings shell; accounts, export and delete account arrive with F2 and F8. */
export function SettingsScreen() {
  const health = useHealth();
  const email = useSession((s) => s.user?.email);
  const signOut = useSignOut();
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
        <ListRow label="API" value={apiValue} valueTone={health.isError ? 'spend' : 'muted'} />
        <ListRow label="App" value={`${appInfo.displayName} · ${__DEV__ ? 'debug' : 'release'}`} last />
      </Card>
    </Screen>
  );
}
