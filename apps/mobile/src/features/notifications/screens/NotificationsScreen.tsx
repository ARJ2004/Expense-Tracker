import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppNotification } from '@et/api-client';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { space, useTheme } from '../../../theme';
import { Card, EmptyState, IconButton, Screen, Text, TopBar } from '../../../ui';
import { useMarkNotificationsRead, useNotifications } from '../hooks';
import { when } from '../labels';
import { openNotificationTarget } from '../targets';

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

/** The inbox: every alert, summary and celebration, including ones held in quiet hours. Opening it marks all read. */
export function NotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const inbox = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = inbox.data?.unreadCount ?? 0;

  useEffect(() => {
    if (unread > 0 && !markRead.isPending) markRead.mutate();
    // Mark once the screen has the list; the unread dots stay until the next visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const open = (n: AppNotification) => openNotificationTarget(navigation, n.data);

  return (
    <Screen>
      <TopBar
        title="Notifications"
        onBack={navigation.goBack}
        action={<IconButton icon="settings" accessibilityLabel="Notification settings" onPress={() => navigation.navigate('NotificationSettings')} />}
      />
      {inbox.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(inbox.error)}
        </Text>
      )}
      {inbox.data?.items.length === 0 && (
        <EmptyState
          title="Nothing yet"
          message="Your morning allowance, evening summary, budget alerts and streaks will show up here."
          actions={[{ label: 'Choose what you get', onPress: () => navigation.navigate('NotificationSettings') }]}
        />
      )}
      {!!inbox.data?.items.length && (
        <Card padding="rows">
          {inbox.data.items.map((n, i) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={`${n.read ? '' : 'New. '}${n.title}. ${n.body}. ${when(n.createdAt)}`}
              onPress={() => open(n)}
              style={[styles.row, i < inbox.data.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            >
              <View style={[styles.dot, !n.read && { backgroundColor: colors.accent }]} />
              <View style={styles.text}>
                <Text variant="bodyStrong">{n.title}</Text>
                <Text variant="secondary" tone="muted">
                  {n.body}
                </Text>
                <Text variant="label" tone="muted">
                  {when(n.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  text: { flex: 1, gap: 2 },
});
