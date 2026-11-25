import React from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import type { GroupDetail } from '@et/api-client';
import { errorMessage } from '../../../lib';
import { fonts, space } from '../../../theme';
import { Button, Card, Text } from '../../../ui';
import { useInvite, useShareInvite, useTurnOffInvite } from '../hooks';

export interface InviteCardProps {
  group: GroupDetail;
}

/** The message the share sheet sends (WhatsApp, SMS, Copy). */
export function inviteMessage(groupName: string, url: string, displayCode: string): string {
  return `Join "${groupName}" on Altus to split expenses: ${url}\n\nOr open Altus → Settings → Groups → Join with code: ${displayCode}`;
}

/**
 * "Invite people": anyone in the group can make and share the link; the owner can reset it (the
 * old one stops working at once) or turn it off.
 */
export function InviteCard({ group }: InviteCardProps) {
  const invite = useInvite(group.id);
  const share = useShareInvite(group.id);
  const turnOff = useTurnOffInvite(group.id);
  const current = invite.data?.invite;
  const failed = (e: unknown) => Alert.alert('Not changed', errorMessage(e));

  const send = async () => {
    const link =
      current ??
      (await share.mutateAsync(false).catch((e: unknown) => {
        failed(e);
        return null;
      }));
    if (link) await Share.share({ message: inviteMessage(group.name, link.url, link.displayCode) }).catch(() => undefined);
  };
  const reset = () =>
    Alert.alert('Reset the link?', 'The current link stops working right away. People already in the group stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => share.mutate(true, { onError: failed }) },
    ]);
  const off = () =>
    Alert.alert('Turn the link off?', 'Nobody new can join until you share a link again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Turn off', style: 'destructive', onPress: () => turnOff.mutate(undefined, { onError: failed }) },
    ]);

  return (
    <Card>
      <Text variant="bodyStrong">Invite people</Text>
      <Text variant="secondary" tone="muted">
        Anyone with the link can join on Altus, pick their name and see this group. {group.isOwner ? 'You can remove people any time.' : ''}
      </Text>
      {current && (
        <View style={styles.link}>
          <Text variant="secondary" tone="muted" selectable numberOfLines={1}>
            {current.url}
          </Text>
          <Text selectable style={styles.code} accessibilityLabel={`Code ${current.displayCode.split('').join(' ')}`}>
            {current.displayCode}
          </Text>
        </View>
      )}
      <Button block label={current ? 'Share link' : 'Share invite link'} loading={share.isPending && !current} onPress={send} />
      {group.isOwner && current && (
        <View style={styles.row}>
          <Button variant="text" label="Reset link" onPress={reset} />
          <Button variant="text" label="Turn off" onPress={off} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  link: { gap: space.xxs },
  code: { fontFamily: fonts.monoSemibold, fontSize: 22, letterSpacing: 2 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
});
