import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GroupDetail, GroupMember } from '@et/api-client';
import { GROUP_LIMITS, memberNameKey } from '@et/domain';
import { MerchantAvatar } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { space } from '../../../theme';
import { Button, Card, ChipGroup, IconButton, SectionLabel, Screen, Tag, Text, TextField, TopBar } from '../../../ui';
import { useSession } from '../../auth';
import {
  useAddMember,
  useCreateGroup,
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
  useRemoveJoined,
  useRemoveMember,
  useTransferOwner,
  useUpdateGroup,
} from '../hooks';
import { GROUP_EMOJI, myGroupName } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GroupForm'>;
type Nav = Props['navigation'];

const EMOJI_CHIPS = GROUP_EMOJI.map((e) => ({ value: e, label: e }));
const TONES = ['soft', 'amber', 'teal'] as const;

/** New group, or edit one: name, icon and members. Editing also archives, leaves or deletes. */
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

interface MemberLineProps {
  name: string;
  isSelf: boolean;
  index: number;
  tags?: string[];
  /** The trailing button: remove a name, or open the owner's options for someone who joined. */
  action?: { icon: 'close' | 'settings'; label: string; onPress: () => void };
  last: boolean;
}

/** One member line: avatar, name, tags ("You", "Owner", "Joined") and an optional button. */
function MemberLine({ name, isSelf, index, tags = [], action, last }: MemberLineProps) {
  return (
    <View style={[styles.member, !last && styles.gap]}>
      <MerchantAvatar name={isSelf ? 'You' : name} tone={isSelf ? 'navy' : TONES[index % TONES.length]} />
      <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
        {isSelf ? `${name} (you)` : name}
      </Text>
      {tags.map((t) => (
        <Tag key={t} tone="neutral" label={t} />
      ))}
      {action && <IconButton icon={action.icon} accessibilityLabel={action.label} onPress={action.onPress} />}
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
  const user = useSession((s) => s.user);
  const myName = myGroupName(user);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(GROUP_EMOJI[0]);
  const [members, setMembers] = useState<string[]>([]);

  const addMember = (n: string) => {
    const keys = [memberNameKey(myName), ...members.map(memberNameKey)];
    if (keys.includes(memberNameKey(n))) {
      Alert.alert('Already in the group', `Someone here is already called ${n}.`);
      return false;
    }
    if (members.length + 1 >= GROUP_LIMITS.maxMembers) return false;
    setMembers([...members, n]);
  };
  const save = () =>
    create.mutate(
      { name: name.trim(), myName, members, ...(emoji ? { emoji } : {}) },
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
        <MemberLine name={myName} isSelf index={0} tags={['Owner']} last={members.length === 0} />
        {members.map((m, i) => (
          <MemberLine
            key={m}
            name={m}
            isSelf={false}
            index={i}
            action={{ icon: 'close', label: `Remove ${m}`, onPress: () => setMembers(members.filter((x) => x !== m)) }}
            last={i === members.length - 1}
          />
        ))}
      </Card>
      <AddMemberField onAdd={addMember} />
      <Text variant="secondary" tone="muted">
        Add people by name now. After creating the group you can share a link so they can join and see it on their phones.
      </Text>
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
  const leave = useLeaveGroup(group.id);
  const addMember = useAddMember(group.id);
  const removeMember = useRemoveMember(group.id);
  const removeJoined = useRemoveJoined(group.id);
  const transfer = useTransferOwner(group.id);
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState<string | null>(group.emoji);
  const others = group.members.filter((m) => !m.isSelf);
  const failed = (title: string) => (e: unknown) => Alert.alert(title, errorMessage(e));

  const save = () => update.mutate({ name: name.trim(), ...(emoji ? { emoji } : {}) }, { onSuccess: () => navigation.goBack(), onError: failed('Not saved') });
  const add = (n: string) => addMember.mutate(n, { onError: failed('Not added') });
  const ownerOptions = (m: GroupMember) =>
    Alert.alert(m.name, 'They joined this group on Altus.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make owner',
        onPress: () =>
          Alert.alert(`Make ${m.name} the owner?`, 'They can then reset the link, remove people and delete the group. You stay in the group.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Make owner', onPress: () => transfer.mutate(m.id, { onError: failed('Not changed') }) },
          ]),
      },
      {
        text: 'Remove from group',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Remove ${m.name}?`, 'They stop seeing this group. Their name, expenses and payments stay, so nobody’s balance changes.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeJoined.mutate(m.id, { onError: failed('Not removed') }) },
          ]),
      },
    ]);
  const action = (m: GroupMember): MemberLineProps['action'] => {
    if (m.isSelf) return undefined;
    if (!m.joined) return { icon: 'close', label: `Remove ${m.name}`, onPress: () => removeMember.mutate(m.id, { onError: failed('Can’t remove them') }) };
    return group.isOwner ? { icon: 'settings', label: `Options for ${m.name}`, onPress: () => ownerOptions(m) } : undefined;
  };
  const archive = () => update.mutate({ archived: !group.archived }, { onSuccess: () => navigation.navigate('Groups'), onError: failed('Not changed') });
  const confirmLeave = () =>
    Alert.alert(`Leave ${group.name}?`, 'You stop seeing this group. Your name and what you paid stay, so nobody’s balance changes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leave.mutate(undefined, { onSuccess: () => navigation.navigate('Groups'), onError: failed('Couldn’t leave') }) },
    ]);
  const confirmDelete = () =>
    Alert.alert(`Delete ${group.name}?`, 'It’s removed for everyone in it, with its expenses and payments. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(undefined, { onSuccess: () => navigation.navigate('Groups'), onError: failed('Not deleted') }) },
    ]);

  return (
    <Screen footer={<Button block label="Save changes" loading={update.isPending} disabled={!name.trim()} onPress={save} />}>
      <TopBar title="Edit group" onBack={navigation.goBack} />
      <NameAndIcon name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} />
      <SectionLabel label={`Members · ${group.members.length}`} />
      <Card>
        {group.members.map((m, i) => (
          <MemberLine
            key={m.id}
            name={m.name}
            isSelf={m.isSelf}
            index={others.indexOf(m)}
            tags={m.isOwner ? ['Owner'] : m.joined && !m.isSelf ? ['Joined'] : []}
            action={action(m)}
            last={i === group.members.length - 1}
          />
        ))}
      </Card>
      <AddMemberField onAdd={add} busy={addMember.isPending} />
      <Text variant="secondary" tone="muted">
        Anyone in the group can add names and edit expenses. A name that is part of an expense or payment can’t be removed until that’s edited or deleted.
      </Text>
      <Button block variant="secondary" label={group.archived ? 'Bring back group' : 'Archive group'} onPress={archive} />
      <Text variant="secondary" tone="muted">
        {group.archived ? 'Puts it back in your active groups.' : 'Hides it from your groups only. Everyone else still sees it.'}
      </Text>
      {group.isOwner ? (
        <>
          <Button block variant="danger" label="Delete group" loading={remove.isPending} onPress={confirmDelete} />
          <Text variant="secondary" tone="muted">
            Removes the group with everything in it, for everyone. To leave instead, make someone else the owner first.
          </Text>
        </>
      ) : (
        <>
          <Button block variant="danger" label="Leave group" loading={leave.isPending} onPress={confirmLeave} />
          <Text variant="secondary" tone="muted">
            You can join again with the group’s link.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  gap: { marginBottom: space.xxs },
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
});
