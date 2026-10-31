import React, { useState } from 'react';
import { Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PermissionExplainer } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Card, EmptyState, ListRow, Screen, Text, TopBar } from '../../../ui';
import { useSmsSync } from '../hooks';
import { DISCLOSURE, lastSyncLabel, syncSummary } from '../labels';
import { requestSmsPermission, smsCaptureAvailable } from '../permission';
import { useSmsCapture } from '../store';

type Props = NativeStackScreenProps<MainStackParamList, 'SmsCapture'>;

/**
 * Bank SMS capture. Off: the full-screen disclosure, and Allow is the only way to Android's
 * prompt. On: when it last checked, Check now, and Turn off.
 */
export function SmsCaptureScreen({ navigation }: Props) {
  const enabled = useSmsCapture((s) => s.enabled);
  const lastSyncMs = useSmsCapture((s) => s.lastSyncMs);
  const setEnabled = useSmsCapture((s) => s.setEnabled);
  const reset = useSmsCapture((s) => s.reset);
  const sync = useSmsSync();
  const [asking, setAsking] = useState(false);
  const [permission, setPermission] = useState<'denied' | 'blocked' | null>(null);

  if (!smsCaptureAvailable()) {
    return (
      <Screen>
        <TopBar title="Bank SMS" onBack={navigation.goBack} />
        <EmptyState title="Android only" message="Reading bank SMS works on Android phones. Import a statement instead." />
      </Screen>
    );
  }

  const allow = async () => {
    setPermission(null);
    setAsking(true);
    const result = await requestSmsPermission();
    setAsking(false);
    if (result === 'granted') {
      setEnabled(true);
      sync.mutate();
    } else {
      setPermission(result === 'blocked' ? 'blocked' : 'denied');
    }
  };
  const blocked = permission === 'blocked';

  if (!enabled) {
    return (
      <Screen scroll={false}>
        <PermissionExplainer
          icon="sms"
          title={DISCLOSURE.title}
          points={DISCLOSURE.points}
          never={DISCLOSURE.never}
          allowLabel={blocked ? 'Open Android settings' : 'Allow SMS access'}
          onAllow={blocked ? () => Linking.openSettings().then(() => setPermission(null)) : allow}
          onDecline={navigation.goBack}
          loading={asking}
          error={
            blocked
              ? 'Android won’t ask again. Allow SMS for Altus in Settings → Apps → Altus → Permissions, then come back.'
              : permission === 'denied'
                ? 'SMS stays off. You can allow it any time.'
                : null
          }
          onBack={navigation.goBack}
        />
      </Screen>
    );
  }

  const turnOff = () => {
    sync.reset();
    reset();
  };

  return (
    <Screen>
      <TopBar title="Bank SMS" onBack={navigation.goBack} />
      <Card>
        <Text variant="heading">Reading bank SMS</Text>
        <Text variant="secondary" tone="muted">
          {lastSyncLabel(lastSyncMs)}
        </Text>
        {sync.isSuccess && (
          <Text variant="secondary" accessibilityLiveRegion="polite">
            {syncSummary(sync.data)}
          </Text>
        )}
        {sync.isError && (
          <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
            {errorMessage(sync.error)}
          </Text>
        )}
        <Button block label="Check now" loading={sync.isPending} onPress={() => sync.mutate()} />
      </Card>
      <Card padding="rows">
        <ListRow label="Turn off" tone="danger" onPress={turnOff} last />
      </Card>
      <Text variant="secondary" tone="muted">
        {DISCLOSURE.never} To also stop Android access, remove the SMS permission in Android settings.
      </Text>
    </Screen>
  );
}
