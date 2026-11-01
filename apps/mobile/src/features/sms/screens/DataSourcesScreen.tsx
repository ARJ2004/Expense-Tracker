import React, { useState } from 'react';
import { Linking } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SourceStat } from '@et/api-client';
import { PermissionExplainer } from '../../../components';
import { errorMessage, type MainStackParamList, type MainTabParamList } from '../../../lib';
import { Button, Card, ListRow, ProgressBar, Screen, SectionLabel, Text, TopBar } from '../../../ui';
import { useSmsSync, useSourceStats } from '../hooks';
import { coverageLabel, DISCLOSURE, lastActivityLabel, lastSyncLabel, progressLabel, syncSummary, transactionsLabel } from '../labels';
import { requestSmsPermission, smsCaptureAvailable } from '../permission';
import { useSmsCapture } from '../store';

type Props = NativeStackScreenProps<MainStackParamList, 'DataSources'>;

/**
 * Where transactions come from: bank SMS (Android, on this phone), statements and manual entry,
 * each with how many transactions it added. Turning SMS on goes through the full-screen
 * disclosure, and Allow there is the only way to Android's prompt.
 */
export function DataSourcesScreen({ navigation, route }: Props) {
  const enabled = useSmsCapture((s) => s.enabled);
  const lastSyncMs = useSmsCapture((s) => s.lastSyncMs);
  const progress = useSmsCapture((s) => s.progress);
  const setEnabled = useSmsCapture((s) => s.setEnabled);
  const reset = useSmsCapture((s) => s.reset);
  const tabs = useNavigation<NavigationProp<{ Tabs: { screen: keyof MainTabParamList } }>>();
  const stats = useSourceStats();
  const sync = useSmsSync();
  const smsAvailable = smsCaptureAvailable();
  const [disclosing, setDisclosing] = useState(smsAvailable && !enabled && !!route.params?.explainSms);
  const [asking, setAsking] = useState(false);
  const [permission, setPermission] = useState<'denied' | 'blocked' | null>(null);

  const allow = async () => {
    setPermission(null);
    setAsking(true);
    const result = await requestSmsPermission();
    setAsking(false);
    if (result === 'granted') {
      setEnabled(true);
      setDisclosing(false);
      sync.mutate();
    } else {
      setPermission(result === 'blocked' ? 'blocked' : 'denied');
    }
  };
  const blocked = permission === 'blocked';

  if (disclosing) {
    return (
      <Screen scroll={false}>
        <PermissionExplainer
          icon="sms"
          title={DISCLOSURE.title}
          points={DISCLOSURE.points}
          never={DISCLOSURE.never}
          allowLabel={blocked ? 'Open Android settings' : 'Allow SMS access'}
          onAllow={blocked ? () => Linking.openSettings().then(() => setPermission(null)) : allow}
          onDecline={() => setDisclosing(false)}
          loading={asking}
          error={
            blocked
              ? 'Android won’t ask again. Allow SMS for Altus in Settings → Apps → Altus → Permissions, then come back.'
              : permission === 'denied'
                ? 'SMS stays off. You can allow it any time.'
                : null
          }
          onBack={() => setDisclosing(false)}
        />
      </Screen>
    );
  }

  const turnOff = () => {
    sync.reset();
    reset();
  };
  const stat = (kind: SourceStat['kind']) => stats.data?.find((s) => s.kind === kind);
  /** Until the stats load (or if they can't), a dash or ellipsis instead of a wrong zero or "Never". */
  const pending = stats.isError ? '—' : '…';
  const count = (kind: SourceStat['kind']) => (stats.data ? transactionsLabel(stat(kind)?.transactions ?? 0) : pending);

  return (
    <Screen>
      <TopBar title="Data sources" onBack={navigation.goBack} />

      <SectionLabel label="Bank SMS" />
      {!smsAvailable ? (
        <Card>
          <Text variant="secondary" tone="muted">
            Reading bank SMS works on Android phones with the SMS build. Import a statement instead.
          </Text>
        </Card>
      ) : enabled ? (
        <>
          <Card>
            <Text variant="heading">Reading bank SMS</Text>
            <Text variant="secondary" tone="muted">
              New bank SMS are added as they arrive. {lastSyncLabel(lastSyncMs)}.
            </Text>
            {progress && (
              <>
                <ProgressBar value={progress.total > 0 ? progress.read / progress.total : 0} accessibilityLabel="Reading your SMS" />
                <Text variant="secondary" accessibilityLiveRegion="polite">
                  {progressLabel(progress)}
                </Text>
              </>
            )}
            {sync.isSuccess && !progress && (
              <Text variant="secondary" accessibilityLiveRegion="polite">
                {syncSummary(sync.data)}
              </Text>
            )}
            {__DEV__ && sync.isSuccess && !progress && (
              <Text variant="secondary" tone="muted">
                {coverageLabel(sync.data)}
              </Text>
            )}
            {sync.isError && (
              <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
                {errorMessage(sync.error)}
              </Text>
            )}
            <Button block variant="secondary" label="Check now" loading={sync.isPending} onPress={() => sync.mutate()} />
          </Card>
          <Card padding="rows">
            <ListRow label="Transactions" value={count('sms')} />
            <ListRow label="Turn off" tone="danger" onPress={turnOff} last />
          </Card>
        </>
      ) : (
        <Card>
          <Text variant="secondary" tone="muted">
            Off. Turn it on to add UPI and card spends from your bank’s SMS as they arrive.
          </Text>
          <Button block label="Turn on" onPress={() => setDisclosing(true)} />
        </Card>
      )}

      <SectionLabel label="Statements" />
      <Card padding="rows">
        <ListRow label="Transactions" value={count('statement')} />
        <ListRow label="Last import" value={stats.data ? lastActivityLabel(stat('statement')?.lastAt ?? null) : pending} valueTone="muted" />
        <ListRow label="Import a statement" onPress={() => tabs.navigate('Tabs', { screen: 'Imports' })} last />
      </Card>

      <SectionLabel label="Added by you" />
      <Card padding="rows">
        <ListRow label="Transactions" value={count('manual')} last />
      </Card>

      {smsAvailable && (
        <Text variant="secondary" tone="muted">
          {DISCLOSURE.never} To also stop Android access, remove the SMS permission in Android settings.
        </Text>
      )}
    </Screen>
  );
}
