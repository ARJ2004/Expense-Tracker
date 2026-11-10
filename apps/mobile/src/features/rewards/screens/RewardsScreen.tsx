import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addDays, istDateKey } from '@et/domain';
import { DayDots, type DayDot } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { space, useTheme } from '../../../theme';
import { Card, HeroSurface, SectionLabel, Screen, Text, TopBar } from '../../../ui';
import { BadgeGrid } from '../components/BadgeGrid';
import { useRewards } from '../hooks';

type Props = NativeStackScreenProps<MainStackParamList, 'Rewards'>;

/** Streak and badges: days in a row within the daily allowance, the last two weeks, every badge. */
export function RewardsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const rewards = useRewards();
  const data = rewards.data;
  const today = istDateKey(new Date());

  const days: DayDot[] = [];
  for (let i = 14; i >= 1; i--) {
    const day = addDays(today, -i);
    const o = data?.last14.find((d) => d.day === day);
    days.push({ day, look: !o ? 'none' : o.underBudget ? 'done' : 'missed', said: !o ? 'no record' : o.underBudget ? 'within allowance' : 'over allowance' });
  }
  days.push({ day: today, look: 'pending', said: 'today, still open' });

  return (
    <Screen>
      <TopBar title="Streak and badges" onBack={navigation.goBack} />
      {rewards.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(rewards.error)}
        </Text>
      )}
      {data && (
        <>
          <HeroSurface>
            <Text variant="eyebrow" style={{ color: colors.heroMuted }}>
              Within your allowance
            </Text>
            <Text variant="hero" style={{ color: colors.heroText }}>
              🔥 {data.streak.current} {data.streak.current === 1 ? 'day' : 'days'}
            </Text>
            <Text variant="secondary" style={{ color: colors.heroMuted }}>
              {data.streak.best > data.streak.current ? `Best: ${data.streak.best} days. ` : ''}Each day closes the next morning.
            </Text>
          </HeroSurface>
          <Card>
            <View style={styles.head}>
              <Text variant="bodyStrong">Last two weeks</Text>
              <Text variant="secondary" tone="muted">
                {data.last14.filter((d) => d.underBudget).length} of {data.last14.length} within
              </Text>
            </View>
            <DayDots label="Last 14 days and today" days={days} />
          </Card>
          <SectionLabel label={`Badges · ${data.badges.filter((b) => b.unlockedAt).length} of ${data.badges.length}`} />
          <BadgeGrid badges={data.badges} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
});
