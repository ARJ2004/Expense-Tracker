import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CategorySpend } from '@et/api-client';
import { CategoryBar } from '../../../components';
import { useTheme } from '../../../theme';
import { Card, Text } from '../../../ui';
import { barRatio } from '../summary';

export interface WhereItWentProps {
  items: CategorySpend[];
  monthName: string;
  onSeeAll: () => void;
}

const TOP = 5;

/** Home's "Where it went" card: the five largest categories, coloured by rank as in the mockup. */
export function WhereItWent({ items, monthName, onSeeAll }: WhereItWentProps) {
  const { colors } = useTheme();
  const largest = items[0]?.spendPaise ?? 0;
  return (
    <Card>
      <View style={styles.head}>
        <Text variant="heading" accessibilityRole="header">
          Where it went
        </Text>
        {items.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="See all categories" onPress={onSeeAll} hitSlop={12}>
            <Text variant="bodyStrong" tone="accent">
              See all
            </Text>
          </Pressable>
        )}
      </View>
      {items.length === 0 ? (
        <Text variant="secondary" tone="muted">
          No spending in {monthName}.
        </Text>
      ) : (
        items
          .slice(0, TOP)
          .map((c, i) => (
            <CategoryBar
              key={c.category.id}
              name={c.category.name}
              paise={c.spendPaise}
              ratio={barRatio(c.spendPaise, largest)}
              color={colors.chart[i % colors.chart.length]!}
            />
          ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
