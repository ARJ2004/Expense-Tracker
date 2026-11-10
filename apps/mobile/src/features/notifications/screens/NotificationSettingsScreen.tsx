import React from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotificationGroup, NotificationSetting } from '@et/api-client';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Card, SectionLabel, Screen, Text, Toggle, TopBar } from '../../../ui';
import { useNotificationSettings, useSendTestNotification, useUpdateNotificationSettings } from '../hooks';
import { GROUP_LABELS, TEST_RESULT } from '../labels';
import { usePushStatus } from '../push';

type Props = NativeStackScreenProps<MainStackParamList, 'NotificationSettings'>;

const GROUPS: NotificationGroup[] = ['daily', 'alerts', 'rewards'];

/** Every notification type with a switch, grouped; quiet hours and the daily cap explained; a test push. */
export function NotificationSettingsScreen({ navigation }: Props) {
  const settings = useNotificationSettings();
  const update = useUpdateNotificationSettings();
  const test = useSendTestNotification();
  const push = usePushStatus();
  const items = settings.data?.items ?? [];

  const toggle = (item: NotificationSetting, on: boolean) => {
    const off = items.filter((i) => (i.type === item.type ? !on : !i.enabled)).map((i) => i.type);
    update.mutate(off, { onError: (e) => Alert.alert('Couldn’t save', errorMessage(e)) });
  };

  return (
    <Screen>
      <TopBar title="Notification settings" onBack={navigation.goBack} />
      {settings.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(settings.error)}
        </Text>
      )}
      <Text variant="secondary" tone="muted">
        No pushes between 10 pm and 8 am, and at most 3 a day plus the evening summary. Anything held back still lands in your inbox.
      </Text>
      {push !== 'on' && (
        <Card>
          <Text variant="bodyStrong">{push === 'blocked' ? 'Notifications are off for Altus' : 'Push isn’t set up on this phone yet'}</Text>
          <Text variant="secondary" tone="muted">
            {push === 'blocked' ? 'Turn them on in Android settings → Apps → Altus → Notifications.' : 'Until then, everything still shows in your inbox.'}
          </Text>
        </Card>
      )}
      {GROUPS.map((group) => (
        <React.Fragment key={group}>
          <SectionLabel label={GROUP_LABELS[group]} />
          <Card>
            {items
              .filter((i) => i.group === group)
              .map((i) => (
                <Toggle key={i.type} label={i.label} hint={i.description} value={i.enabled} onValueChange={(on) => toggle(i, on)} />
              ))}
          </Card>
        </React.Fragment>
      ))}
      <Button
        block
        variant="secondary"
        label={test.isPending ? 'Sending…' : 'Send a test notification'}
        onPress={() =>
          test.mutate(undefined, {
            onSuccess: (result) => Alert.alert('Test notification', TEST_RESULT[result] ?? result),
            onError: (e) => Alert.alert('Couldn’t send', errorMessage(e)),
          })
        }
      />
    </Screen>
  );
}
