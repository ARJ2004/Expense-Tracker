import React from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatISTTime, istDateKey } from '@et/domain';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Screen, Text, TopBar } from '../../../ui';
import { PersonRow } from '../components/PersonRow';
import { useGroup, useGroupHistory } from '../hooks';
import { byDay, dayLabel, memberTone } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'GroupHistory'>;

/** Who did what in the group, newest first, deleted expenses included. */
export function GroupHistoryScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const group = useGroup(id);
  const history = useGroupHistory(id);
  const today = istDateKey(new Date());
  const items = (history.data?.pages.flatMap((p) => p.items) ?? []).map((h) => ({ ...h, day: istDateKey(new Date(h.createdAt)) }));
  const members = group.data?.members ?? [];

  return (
    <Screen>
      <TopBar title="History" onBack={navigation.goBack} />
      {history.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(history.error)}
        </Text>
      )}
      {byDay(items).map(({ day, items: rows }) => (
        <View key={day}>
          <Text variant="label" tone="muted">
            {dayLabel(day, today).toUpperCase()}
          </Text>
          {rows.map((h) => {
            const who = h.actorIsSelf ? 'You' : (h.actorName ?? 'Someone');
            const member = members.find((m) => m.name === h.actorName);
            return (
              <PersonRow
                key={h.id}
                name={who}
                tone={h.actorIsSelf ? 'navy' : member ? memberTone(members, member.id) : 'neutral'}
                title={`${who} ${h.text}`}
                subtitle={formatISTTime(new Date(h.createdAt))}
                divider={false}
              />
            );
          })}
        </View>
      ))}
      {history.hasNextPage && <Button variant="text" label="Show more" loading={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} />}
    </Screen>
  );
}
