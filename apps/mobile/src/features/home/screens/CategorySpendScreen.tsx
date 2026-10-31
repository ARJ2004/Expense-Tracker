import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatINR, istMonthKey, monthLabel } from '@et/domain';
import { CategoryBar } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { paletteColor, useTheme } from '../../../theme';
import { Card, Screen, SectionLabel, Text, TopBar } from '../../../ui';
import { useDashboardSummary } from '../hooks';
import { barRatio } from '../summary';

type Props = NativeStackScreenProps<MainStackParamList, 'CategorySpend'>;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "See all" from Home: every category with spend in the month, then the top merchants. */
export function CategorySpendScreen({ navigation, route }: Props) {
  const { month } = route.params;
  const { colors } = useTheme();
  const summary = useDashboardSummary(month);
  const name = monthLabel(month, Number(istMonthKey(new Date()).slice(0, 4)));
  const data = summary.data;
  const largest = data?.byCategory[0]?.spendPaise ?? 0;
  const merchantMax = data?.topMerchants[0]?.spendPaise ?? 0;
  return (
    <Screen>
      <TopBar title={`Where it went · ${name}`} onBack={() => navigation.goBack()} />
      {summary.isError && !data && (
        <Text variant="secondary" tone="muted">
          {errorMessage(summary.error)}
        </Text>
      )}
      {data && (
        <>
          <Text variant="secondary" tone="muted">
            {formatINR(data.spendPaise)} spent
            {data.refundPaise > 0 ? `, after ${formatINR(data.refundPaise)} in refunds` : ''}. Transfers between your accounts aren't counted.
          </Text>
          <Card>
            {data.byCategory.length === 0 ? (
              <Text variant="secondary" tone="muted">
                No spending in {name}.
              </Text>
            ) : (
              data.byCategory.map((c) => (
                <CategoryBar
                  key={c.category.id}
                  name={c.category.name}
                  paise={c.spendPaise}
                  ratio={barRatio(c.spendPaise, largest)}
                  color={paletteColor(colors, c.category.color)}
                  icon={{ name: c.category.icon, color: c.category.color }}
                  meta={plural(c.count, 'payment')}
                />
              ))
            )}
          </Card>
          {data.topMerchants.length > 0 && (
            <>
              <SectionLabel label="Top merchants" />
              <Card>
                {data.topMerchants.map((m) => (
                  <CategoryBar
                    key={m.merchantName}
                    name={m.merchantName}
                    paise={m.spendPaise}
                    ratio={barRatio(m.spendPaise, merchantMax)}
                    color={colors.accent}
                    meta={plural(m.count, 'payment')}
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
