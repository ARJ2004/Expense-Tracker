import React from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AmountField } from '../../../components';
import { space } from '../../../theme';
import { Button, ChipGroup, Text } from '../../../ui';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { useOnboardingDraft } from '../draft';
import { FREQUENCY_OPTIONS } from '../labels';
import type { OnboardingParamList } from '../OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingParamList, 'Income'>;

/** Step 1: monthly income and pay frequency, both skippable. */
export function IncomeStep({ navigation }: Props) {
  const { incomeDigits, frequency, setIncome, setFrequency, skipIncome } = useOnboardingDraft();
  const next = () => navigation.navigate('Accounts');

  return (
    <OnboardingFrame
      step={1}
      title="How much do you earn each month?"
      subtitle="We use this to size your budget. You can change it later."
      footer={
        <>
          <Button block label="Continue" disabled={incomeDigits === ''} onPress={next} />
          <Button
            variant="text"
            label="Skip for now"
            onPress={() => {
              skipIncome();
              next();
            }}
          />
        </>
      }
    >
      <AmountField accessibilityLabel="Monthly income in rupees" value={incomeDigits} onChange={setIncome} />
      <Text variant="bodyStrong" style={styles.question}>
        How often are you paid?
      </Text>
      <ChipGroup accessibilityLabel="Pay frequency" options={FREQUENCY_OPTIONS} value={frequency} onChange={setFrequency} />
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: space.xs },
});
