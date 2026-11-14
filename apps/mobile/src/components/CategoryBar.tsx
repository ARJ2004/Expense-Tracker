import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatINR } from '@et/domain';
import { wholeRupees } from './rounding';
import { radius, space, useTheme } from '../theme';
import { Text } from '../ui';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryBarProps {
  name: string;
  paise: number;
  /** Bar length, 0 to 1 (spend ÷ the largest category's spend). */
  ratio: number;
  /** Bar colour (a theme colour). */
  color: string;
  /** Show the category's icon before the name (the full list; Home's card leaves it out). */
  icon?: { name: string; color: string };
  /** Small muted line under the name, e.g. "23 payments". */
  meta?: string;
  onPress?: () => void;
  /** Against a budget: warning (80%+) and over (100%+) recolour the bar and the amount. */
  state?: 'ok' | 'warning' | 'over';
}

/**
 * "Where it went" row: name and amount over a thin bar sized against the largest category. On the
 * Budgets screen the bar is spend ÷ budget, and `state` marks a category near or over its budget.
 */
export function CategoryBar({ name, paise, ratio, color, icon, meta, onPress, state = 'ok' }: CategoryBarProps) {
  const { colors } = useTheme();
  const width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` as const;
  const amount = formatINR(wholeRupees(paise), { symbol: false, decimals: 'auto' });
  const barColor = state === 'over' ? colors.spend : state === 'warning' ? colors.warningOn : color;
  const body = (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {icon && <CategoryIcon icon={icon.name} color={icon.color} size={18} />}
        <View style={styles.name}>
          <Text variant="body" numberOfLines={1}>
            {name}
          </Text>
          {meta && (
            <Text variant="secondary" tone="muted">
              {meta}
            </Text>
          )}
        </View>
        <Text variant="mono" tone={state === 'over' ? 'spend' : 'default'}>
          {amount}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.track }]}>
        <View style={[styles.fill, { width, backgroundColor: barColor }]} />
      </View>
    </View>
  );
  const label = `${name}, ₹${amount}${meta ? `, ${meta}` : ''}`;
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { flex: 1 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
