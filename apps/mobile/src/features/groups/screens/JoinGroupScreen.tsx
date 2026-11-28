import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HeroCard } from '../../../components';
import { ApiError, errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Card, EmptyState, SectionLabel, Screen, Text, TopBar } from '../../../ui';
import { useSession } from '../../auth';
import { PersonRow } from '../components/PersonRow';
import { useAcceptInvite, useInvitePreview } from '../hooks';
import { myGroupName } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'JoinGroup'>;

const TONES = ['soft', 'amber', 'teal'] as const;

/**
 * Opened from a join link or a typed code: which group, who invited, and "Which one are you?".
 * Picking a name takes over its expenses and payments; "I'm not on the list" joins as a new name.
 */
export function JoinGroupScreen({ navigation, route }: Props) {
  const { code } = route.params;
  const preview = useInvitePreview(code);
  const accept = useAcceptInvite(code);
  const user = useSession((s) => s.user);
  const p = preview.data;

  useEffect(() => {
    if (p?.alreadyMember) navigation.replace('GroupDetail', { id: p.groupId });
  }, [p, navigation]);

  const join = (body: { memberId?: string; name?: string }) =>
    accept.mutate(body, {
      onSuccess: (g) => navigation.replace('GroupDetail', { id: g.id }),
      onError: (e) => {
        Alert.alert('Couldn’t join', errorMessage(e));
        if (e instanceof ApiError && e.code === 'GROUP_MEMBER_ALREADY_LINKED') preview.refetch();
      },
    });

  if (preview.isError) {
    const gone = preview.error instanceof ApiError && preview.error.code === 'INVITE_NOT_FOUND';
    return (
      <Screen>
        <TopBar title="Join group" onBack={navigation.goBack} />
        <EmptyState
          title={gone ? 'This link doesn’t work any more' : 'Couldn’t open the link'}
          message={gone ? 'It was turned off or the group was deleted. Ask the person who sent it for a new one.' : errorMessage(preview.error)}
          actions={gone ? [{ label: 'Go to Groups', onPress: () => navigation.replace('Groups') }] : [{ label: 'Try again', onPress: () => preview.refetch() }]}
        />
      </Screen>
    );
  }
  if (!p || p.alreadyMember) {
    return (
      <Screen>
        <TopBar title="Join group" onBack={navigation.goBack} />
      </Screen>
    );
  }

  const open = p.members.filter((m) => !m.joined);
  const taken = p.members.filter((m) => m.joined);
  const confirm = (memberId: string, name: string) =>
    Alert.alert(`Join as ${name}?`, `Everything ${name} paid or shares in ${p.groupName} becomes yours.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `I'm ${name}`, onPress: () => join({ memberId }) },
    ]);

  return (
    <Screen
      footer={<Button block variant="secondary" label="I'm not on the list" loading={accept.isPending && !accept.variables?.memberId} onPress={() => join({ name: myGroupName(user) })} />}
    >
      <TopBar title="Join group" onBack={navigation.goBack} />
      <HeroCard label={`${p.invitedBy} invited you`} paise={0} headline={`${p.emoji ? `${p.emoji} ` : ''}${p.groupName}`} pill={`${p.members.length} people`} />
      <Text variant="secondary" tone="muted">
        Everyone in this group sees its expenses and payments. Nothing else from your Altus account is shared.
      </Text>
      {open.length > 0 && (
        <>
          <SectionLabel label="Which one are you?" />
          <Card padding="rows">
            {open.map((m, i) => (
              <PersonRow
                key={m.id}
                name={m.name}
                tone={TONES[i % TONES.length] ?? 'soft'}
                title={m.name}
                caption="That's me"
                onPress={() => confirm(m.id, m.name)}
                accessibilityLabel={`I'm ${m.name}`}
                last={i === open.length - 1}
              />
            ))}
          </Card>
        </>
      )}
      {taken.length > 0 && (
        <>
          <SectionLabel label="Already joined" />
          <Card padding="rows">
            {taken.map((m, i) => (
              <PersonRow key={m.id} name={m.name} tone="neutral" title={m.name} caption="joined" last={i === taken.length - 1} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
