import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GroupDetail } from '@et/api-client';
import { GROUP_LIMITS, memberNameKey } from '@et/domain';
import { MerchantAvatar } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { space } from '../../../theme';
import { Button, Card, ChipGroup, IconButton, SectionLabel, Screen, Tag, Text, TextField, TopBar } from '../../../ui';
import { useAddMember, useCreateGroup, useDeleteGroup, useGroup, useRemoveMember, useUpdateGroup } from '../hooks';
import { GROUP_EMOJI } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GroupForm'>;
type Nav = Props['navigation'];

const EMOJI_CHIPS = GROUP_EMOJI.map((e) => ({ value: e, label: e }));
const TONES = ['soft', 'amber', 'teal'] as const;

/** New group, or edit one: name, icon and members by name. Editing also archives or deletes. */
export function GroupFormScreen({ navigation, route }: Props) {
  const id = route.params?.id;
  return id ? <EditGroup id={id} navigation={navigation} /> : <NewGroup navigation={navigation} />;
}

/** Name and icon fields, shared by both forms. */
function NameAndIcon({ name, setName, emoji, setEmoji, autoFocus }: { name: string; setName: (v: string) => void; emoji: string | null; setEmoji: (v: string) => void; autoFocus?: boolean }) {
  return (
    <>
      <TextField label="Group name" placeholder="Goa trip" value={name} onChangeText={setName} maxLength={GROUP_LIMITS.nameLength.max} autoFocus={autoFocus} />
      <Text variant="label" tone="muted">
        Icon
      </Text>
      <ChipGroup scroll accessibilityLabel="Group icon" options={EMOJI_CHIPS} value={emoji} onChange={setEmoji} />
    </>
  );
}

/** One member line: avatar, name, and either "Always included" (You) or a remove button. */
function MemberLine({ name, isSelf, index, onRemove, last }: { name: string; isSelf: boolean; index: number; onRemove?: () => void; last: boolean }) {
  return (
    <View style={[styles.member, !last && styles.gap]}>
      <MerchantAvatar name={isSelf ? 'You' : name} tone={isSelf ? 'navy' : TONES[index % TONES.length]} />
      <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
        {isSelf ? 'You' : name}
      </Text>
      {isSelf ? <Tag tone="neutral" label="Always included" /> : onRemove && <IconButton icon="close" accessibilityLabel={`Remove ${name}`} onPress={onRemove} />}
    </View>
  );
}

/** "Add a member" field with its button. */
function AddMemberField({ onAdd, busy }: { onAdd: (name: string) => boolean | void; busy?: boolean }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (onAdd(name) !== false) setDraft('');
  };
  return (
    <View style={styles.addRow}>
      <View style={styles.flex}>
        <TextField label="Add a member" placeholder="Name" value={draft} onChangeText={setDraft} maxLength={GROUP_LIMITS.memberNameLength.max} onSubmitEditing={add} returnKeyType="done" />
      </View>
      <Button variant="secondary" label="Add" loading={busy} disabled={!draft.trim()} onPress={add} />
    </View>
  );
}

function NewGroup({ navigation }: { navigation: Nav }) {
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(GROUP_EMOJI[0]);
  const [members, setMembers] = useState<string[]>([]);

  const addMember = (n: string) => {
    const keys = ['you', ...members.map(memberNameKey)];
    if (keys.includes(memberNameKey(n))) {
      Alert.alert('Already in the group', `Someone here is already called ${n}.`);
      return false;
    }
    if (members.length + 1 >= GROUP_LIMITS.maxMembers) return false;
    setMembers([...members, n]);
  };
  const save = () =>
    create.mutate(
      { name: name.trim(), members, ...(emoji ? { emoji } : {}) },
      {
        onSuccess: (g) => navigation.replace('GroupDetail', { id: g.id }),
        onError: (e) => Alert.alert('Not created', errorMessage(e)),
      },
    );

  return (
    <Screen footer={<Button block label="Create group" loading={create.isPending} disabled={!name.trim()} onPress={save} />}>
      <TopBar title="New group" onBack={navigation.goBack} />
      <NameAndIcon name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} autoFocus />
      <SectionLabel label={`Members · ${members.length + 1}`} />
      <Card>
        <MemberLine name="You" isSelf index={0} last={members.length === 0} />
        {members.map((m, i) => (
          <MemberLine key={m} name={m} isSelf={false} index={i} onRemove={() => setMembers(members.filter((x) => x !== m))} last={i === members.length - 1} />
        ))}
      </Card>
      <AddMemberField onAdd={addMember} />
    </Screen>
  );
}

function EditGroup({ id, navigation }: { id: string; navigation: Nav }) {
  const group = useGroup(id);
  if (!group.data) {
    return (
      <Screen>
        <TopBar title="Edit group" onBack={navigation.goBack} />
        {group.isError && (
          <Text variant="secondary" tone="spend">
            {errorMessage(group.error)}
          </Text>
        )}
      </Screen>
    );
  }
  return <EditGroupForm group={group.data} navigation={navigation} />;
}

function EditGroupForm({ group, navigation }: { group: GroupDetail; navigation: Nav }) {
  const update = useUpdateGroup(group.id);
  const remove = useDeleteGroup(group.id);
  const addMember = useAddMember(group.id);
  const removeMember = useRemoveMember(group.id);
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState<string | null>(group.emoji);
  const others = group.members.filter((m) => !m.isSelf);

  const save = () =>
    update.mutate(
      { name: name.trim(), ...(emoji ? { emoji } : {}) },
      { onSuccess: () => navigation.goBack(), onError: (e) => Alert.alert('Not saved', errorMessage(e)) },
    );
  const add = (n: string) => addMember.mutate(n, { onError: (e) => Alert.alert('Not added', errorMessage(e)) });
  const drop = (memberId: string) => removeMember.mutate(memberId, { onError: (e) => Alert.alert('Can’t remove them', errorMessage(e)) });
  const archive = () =>
    update.mutate({ archived: !group.archived }, { onSuccess: () => navigation.navigate('Groups'), onError: (e) => Alert.alert('Not changed', errorMessage(e)) });
  const confirmDelete = () =>
    Alert.alert(`Delete ${group.name}?`, 'Its members, expenses and payments are removed. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(undefined, { onSuccess: () => navigation.navigate('Groups'), onError: (e) => Alert.alert('Not deleted', errorMessage(e)) }),
      },
    ]);

  return (
    <Screen footer={<Button block label="Save changes" loading={update.isPending} disabled={!name.trim()} onPress={save} />}>
      <TopBar title="Edit group" onBack={navigation.goBack} />
      <NameAndIcon name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} />
      <SectionLabel label={`Members · ${group.members.length}`} />
      <Card>
        {group.members.map((m, i) => (
          <MemberLine key={m.id} name={m.name} isSelf={m.isSelf} index={others.indexOf(m)} onRemove={() => drop(m.id)} last={i === group.members.length - 1} />
        ))}
      </Card>
      <AddMemberField onAdd={add} busy={addMember.isPending} />
      <Text variant="secondary" tone="muted">
        Someone who is part of an expense or payment can’t be removed until it’s edited or deleted.
      </Text>
      <Button block variant="secondary" label={group.archived ? 'Bring back group' : 'Archive group'} onPress={archive} />
      <Text variant="secondary" tone="muted">
        {group.archived ? 'Puts it back in your active groups.' : 'Hides it from your groups. Balances and history are kept.'}
      </Text>
      <Button block variant="danger" label="Delete group" loading={remove.isPending} onPress={confirmDelete} />
      <Text variant="secondary" tone="muted">
        Removes the group with everything in it.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  gap: { marginBottom: space.xxs },
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
});
