import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GroupActivity, GroupDetail } from '@et/api-client';
import { istDateKey } from '@et/domain';
import { HeroCard } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Card, IconButton, SectionLabel, Screen, Text, TopBar } from '../../../ui';
import { InviteCard } from '../components/InviteCard';
import { PersonRow } from '../components/PersonRow';
import { SettleUpSheet, type SettleUpDraft } from '../components/SettleUpSheet';
import { useDeletePayment, useGroup, useGroupActivity } from '../hooks';
import { activityLine, balanceWords, byDay, dayLabel, memberName, memberTone, rupees } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GroupDetail'>;

const signed = (paise: number) => (paise > 0 ? `+${rupees(paise).slice(1)}` : paise < 0 ? `−${rupees(paise).slice(1)}` : '0');

/**
 * One group: my balance, everyone's balance, the payments that settle it, and the activity.
 * Tapping a suggested payment opens the settle-up sheet filled in; tapping an expense edits it.
 */
export function GroupDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const group = useGroup(id, { live: true });
  const [settle, setSettle] = useState<SettleUpDraft | null>(null);
  const g = group.data;

  if (!g) {
    return (
      <Screen>
        <TopBar onBack={navigation.goBack} />
        {group.isError && (
          <Text variant="secondary" tone="spend">
            {errorMessage(group.error)}
          </Text>
        )}
      </Screen>
    );
  }

  const heroLabel = g.settled ? 'All settled up' : g.myNetPaise > 0 ? 'You are owed' : g.myNetPaise < 0 ? 'You owe' : 'You are settled up';
  const self = g.members.find((m) => m.isSelf);
  const others = g.members.find((m) => !m.isSelf);

  return (
    <Screen>
      <TopBar
        title={`${g.emoji ? `${g.emoji} ` : ''}${g.name}`}
        onBack={navigation.goBack}
        action={<IconButton icon="edit" accessibilityLabel="Edit group" onPress={() => navigation.navigate('GroupForm', { id })} />}
      />
      <HeroCard
        label={heroLabel}
        paise={Math.abs(g.myNetPaise)}
        headline={g.settled ? (g.totalSpentPaise > 0 ? 'Everyone is square' : 'No expenses yet') : undefined}
        pill={g.settled && g.totalSpentPaise > 0 ? 'Settled up' : `${g.members.length} members`}
        stats={[
          { label: 'Total spent', paise: g.totalSpentPaise },
          { label: 'My share', paise: g.mySharePaise },
        ]}
      />
      <Button block label="Add expense" onPress={() => navigation.navigate('GroupExpenseForm', { groupId: id })} />
      <Text variant="secondary" tone="muted">
        Group expenses aren’t added to your spending.
      </Text>

      <SectionLabel label="Balances" />
      <Card padding="rows">
        {g.balances.map((b, i) => {
          const m = g.members.find((x) => x.id === b.memberId);
          const words = balanceWords(b.netPaise);
          return (
            <PersonRow
              key={b.memberId}
              name={memberName(m)}
              tone={memberTone(g.members, b.memberId)}
              title={memberName(m)}
              subtitle={m?.isOwner ? 'Owner' : m?.joined ? (m.isSelf ? undefined : 'Joined') : 'Not joined yet'}
              caption={words.words}
              amount={b.netPaise === 0 ? undefined : signed(b.netPaise)}
              amountTone={words.tone}
              last={i === g.balances.length - 1}
            />
          );
        })}
      </Card>

      <InviteCard group={g} />

      <SectionLabel label="Settle up" />
      {g.transfers.length > 0 ? (
        <Card padding="rows">
          {g.transfers.map((t, i) => {
            const from = g.members.find((m) => m.id === t.fromId);
            const to = g.members.find((m) => m.id === t.toId);
            const verb = from?.isSelf ? 'pay' : 'pays';
            return (
              <PersonRow
                key={`${t.fromId}-${t.toId}`}
                name={memberName(from)}
                tone={memberTone(g.members, t.fromId)}
                title={`${memberName(from)} ${verb} ${memberName(to)}`}
                amount={rupees(t.amountPaise)}
                onPress={() => setSettle(t)}
                accessibilityLabel={`${memberName(from)} ${verb} ${memberName(to)} ${rupees(t.amountPaise)}. Record this payment`}
                last={i === g.transfers.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <Card>
          <Text variant="bodyStrong">{g.totalSpentPaise > 0 ? 'Nobody owes anything' : 'Nothing to settle yet'}</Text>
          <Text variant="secondary" tone="muted">
            {g.totalSpentPaise > 0 ? 'Every expense in this group has been paid back.' : 'Add an expense and the payments that settle it show up here.'}
          </Text>
        </Card>
      )}
      {self && others && <Button variant="text" label="Record a payment" onPress={() => setSettle({ fromId: others.id, toId: self.id, amountPaise: 0 })} />}

      <Activity group={g} onEdit={(expenseId) => navigation.navigate('GroupExpenseForm', { groupId: id, expenseId })} />
      <Button variant="text" label="See who changed what" onPress={() => navigation.navigate('GroupHistory', { id })} />

      <SettleUpSheet group={g} draft={settle} onClose={() => setSettle(null)} />
    </Screen>
  );
}

function Activity({ group, onEdit }: { group: GroupDetail; onEdit: (expenseId: string) => void }) {
  const activity = useGroupActivity(group.id, { live: true });
  const removePayment = useDeletePayment(group.id);
  const today = istDateKey(new Date());
  const items = activity.data?.pages.flatMap((p) => p.items) ?? [];

  const openPayment = (item: GroupActivity) => {
    const line = activityLine(item, group.members);
    Alert.alert(line.title, `${rupees(item.amountPaise)} on ${dayLabel(item.day, today)}`, [
      { text: 'Close', style: 'cancel' },
      { text: 'Delete payment', style: 'destructive', onPress: () => removePayment.mutate(item.id, { onError: (e) => Alert.alert('Not deleted', errorMessage(e)) }) },
    ]);
  };

  return (
    <>
      <SectionLabel label="Activity" />
      {activity.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(activity.error)}
        </Text>
      )}
      {activity.data && items.length === 0 && (
        <Text variant="secondary" tone="muted">
          No expenses yet. Tap Add expense to log the first one.
        </Text>
      )}
      {byDay(items).map(({ day, items: rows }) => (
        <View key={day}>
          <Text variant="label" tone="muted">
            {dayLabel(day, today).toUpperCase()}
          </Text>
          {rows.map((item) => {
            const line = activityLine(item, group.members);
            const avatarId = item.kind === 'expense' ? item.paidById : item.fromId;
            const who = group.members.find((m) => m.id === avatarId);
            return (
              <PersonRow
                key={item.id}
                name={memberName(who)}
                tone={memberTone(group.members, avatarId ?? '')}
                emoji={item.kind === 'payment' ? '↔' : undefined}
                title={line.title}
                subtitle={line.subtitle}
                layout="stacked"
                caption={line.caption}
                amount={line.paise > 0 ? rupees(line.paise) : undefined}
                amountTone={line.tone}
                divider={false}
                onPress={() => (item.kind === 'expense' ? onEdit(item.id) : openPayment(item))}
              />
            );
          })}
        </View>
      ))}
      {activity.hasNextPage && <Button variant="text" label="Show more" loading={activity.isFetchingNextPage} onPress={() => activity.fetchNextPage()} />}
    </>
  );
}
