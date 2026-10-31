import React from 'react';
import { Card, ListRow, Screen } from '../../../ui';
import { useHealth } from '../hooks';
import appInfo from '../../../../app.json';

/** Settings shell; profile, accounts and export arrive with F1, F2 and F8. */
export function SettingsScreen() {
  const health = useHealth();
  const apiValue = health.isPending
    ? 'Checking…'
    : health.isError
      ? 'Unreachable'
      : `ok · v${health.data.version}`;
  return (
    <Screen title="Settings" withTabBar>
      <Card padding="rows">
        <ListRow label="API" value={apiValue} valueTone={health.isError ? 'spend' : 'muted'} />
        <ListRow label="App" value={`${appInfo.displayName} · debug`} last />
      </Card>
    </Screen>
  );
}
