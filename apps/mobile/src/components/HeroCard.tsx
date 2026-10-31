import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatINR } from '@et/domain';
import { wholeRupees } from './rounding';
import { fonts, radius, space, useTheme } from '../theme';
import { ProgressBar, Text } from '../ui';

export interface HeroStat {
  label: string;
  paise: number;
  /** "income" draws the figure in the hero income colour. */
  tone?: 'default' | 'income';
}

export interface HeroCardProps {
  /** Small line at the top, e.g. "Spent this month". */
  label: string;
  /** The big amount. */
  paise: number;
  /** Pill on the right of the label, e.g. "56% used". */
  pill?: string;
  /** 0 to 1; omit to hide the bar. */
  progress?: number;
  /** Up to two figures under the bar. */
  stats?: HeroStat[];
}

/** Navy hero card from the Home mockup: label and pill, big mono amount, bar, two small figures. */
export function HeroCard({ label, paise, pill, progress, stats = [] }: HeroCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.hero, borderColor: colors.heroBorder }]}>
      <View style={styles.top}>
        <Text variant="label" style={[styles.label, { color: colors.heroMuted }]}>
          {label}
        </Text>
        {pill && (
          <Text variant="label" style={[styles.pill, { backgroundColor: colors.heroPillBg, color: colors.heroPillFg }]}>
            {pill}
          </Text>
        )}
      </View>
      <Text variant="hero" style={{ color: colors.heroText }} accessibilityLabel={`${label} ₹${formatINR(paise, { symbol: false })}`}>
        {formatINR(wholeRupees(paise), { decimals: 'auto' })}
      </Text>
      {progress !== undefined && <ProgressBar value={progress} surface="hero" accessibilityLabel={pill ?? label} />}
      {stats.length > 0 && (
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text variant="label" style={[styles.statLabel, { color: colors.heroMuted }]}>
                {s.label}
              </Text>
              <Text style={[styles.statValue, { color: s.tone === 'income' ? colors.heroIncome : colors.heroText }]}>
                {formatINR(wholeRupees(s.paise), { symbol: false, decimals: 'auto' })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: 22, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.xxs },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontFamily: fonts.regular },
  statValue: { fontFamily: fonts.monoSemibold, fontSize: 16, lineHeight: 22 },
});
