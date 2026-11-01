import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IncomeFrequency } from '@et/api-client';
import { toPaise } from '@et/domain';
import { AmountField } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, ChipGroup, Screen, Text, TopBar } from '../../../ui';
import { useSession } from '../../auth';
import { FREQUENCY_OPTIONS } from '../../onboarding';
import { useUpdateMe } from '../hooks';

type Props = NativeStackScreenProps<MainStackParamList, 'Income'>;

/** Settings → Income: the monthly figure Home's "Left to spend" and "% used" are measured against. */
export function IncomeScreen({ navigation }: Props) {
  const user = useSession((s) => s.user);
  const update = useUpdateMe();
  // Income is entered in whole rupees; drop any paise rather than round them up into a rupee.
  const [digits, setDigits] = useState(() => (user?.monthlyIncomePaise ? String(Math.trunc(user.monthlyIncomePaise / 100)) : ''));
  const [frequency, setFrequency] = useState<IncomeFrequency | null>(user?.incomeFrequency ?? null);

  const save = (body: Parameters<typeof update.mutate>[0]) =>
    update.mutate(body, {
      onSuccess: () => navigation.goBack(),
      onError: (e) => Alert.alert('Not saved', errorMessage(e)),
    });

  return (
    <Screen
      footer={
        <>
          <Button
            block
            label="Save"
            loading={update.isPending}
            disabled={digits === ''}
            onPress={() => save({ monthlyIncomePaise: toPaise(digits), ...(frequency ? { incomeFrequency: frequency } : {}) })}
          />
          {!!user?.monthlyIncomePaise && <Button variant="text" label="Remove income" onPress={() => save({ monthlyIncomePaise: 0 })} />}
        </>
      }
    >
      <TopBar title="Income" onBack={navigation.goBack} />
      <Text variant="secondary" tone="muted">
        Home compares your spending with this each month. It stays on your account and is never shared.
      </Text>
      <AmountField accessibilityLabel="Monthly income in rupees" value={digits} onChange={setDigits} />
      <Text variant="bodyStrong">How often are you paid?</Text>
      <ChipGroup accessibilityLabel="Pay frequency" options={FREQUENCY_OPTIONS} value={frequency} onChange={setFrequency} />
    </Screen>
  );
}
