import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Card, ChipGroup, EmptyState, IconButton, Text, Screen, TopBar } from '../../../ui';
import { JoinWithCodeSheet } from '../components/JoinWithCodeSheet';
import { PersonRow } from '../components/PersonRow';
import { useGroups } from '../hooks';
import { myNetLabel } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'Groups'>;
type Tab = 'active' | 'archived';

/** Every group with my net balance in it, most recently used first; active or archived. */
export function GroupsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const [joining, setJoining] = useState(false);
  const active = useGroups(false);
  const archived = useGroups(true);
  const groups = tab === 'active' ? active : archived;
  const create = () => navigation.navigate('GroupForm');
  const count = (q: typeof active) => (q.data ? ` · ${q.data.length}` : '');
  const tabs = [
    { value: 'active', label: `Active${count(active)}` },
    { value: 'archived', label: `Archived${count(archived)}` },
  ] as const;

  return (
    <Screen footer={tab === 'active' && !!groups.data?.length && <Button block label="New group" onPress={create} />}>
      <TopBar title="Groups" onBack={navigation.goBack} action={<IconButton icon="plus" accessibilityLabel="New group" onPress={create} />} />
      <ChipGroup accessibilityLabel="Show groups" options={tabs} value={tab} onChange={setTab} />
      {groups.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(groups.error)}
        </Text>
      )}
      {groups.data?.length === 0 &&
        (tab === 'active' ? (
          <Card>
            <EmptyState
              title="No groups yet"
              message="Make a group for a trip, your flat or a party, or join one someone shared with you. Log who paid and see who owes whom."
              actions={[
                { label: 'Create group', onPress: create },
                { label: 'Join with code', onPress: () => setJoining(true) },
              ]}
            />
          </Card>
        ) : (
          <Text variant="secondary" tone="muted">
            Groups you archive show up here.
          </Text>
        ))}
      {!!groups.data?.length && (
        <Card padding="rows">
          {groups.data.map((g, i) => {
            const net = myNetLabel(g.myNetPaise);
            return (
              <PersonRow
                key={g.id}
                name={g.name}
                tone="neutral"
                emoji={g.emoji ?? '👥'}
                title={g.name}
                subtitle={`${g.memberCount} ${g.memberCount === 1 ? 'member' : 'members'}`}
                layout="stacked"
                caption={net.caption}
                amount={net.amount}
                amountTone={net.tone}
                accessibilityLabel={`${g.name}, ${g.memberCount} members, ${net.text}`}
                onPress={() => navigation.navigate('GroupDetail', { id: g.id })}
                last={i === groups.data.length - 1}
              />
            );
          })}
        </Card>
      )}
      {!!groups.data?.length && <Button variant="text" label="Join with code" onPress={() => setJoining(true)} />}
      {/* Mounted only while open: the list doesn't pay for a hidden modal. */}
      {joining && <JoinWithCodeSheet visible onClose={() => setJoining(false)} onCode={(code) => navigation.navigate('JoinGroup', { code })} />}
    </Screen>
  );
}
