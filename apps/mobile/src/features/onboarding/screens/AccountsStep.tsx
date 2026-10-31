import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, ListRow } from '../../../ui';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { AccountForm, kindLabel, useAccounts } from '../../accounts';
import type { OnboardingParamList } from '../OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingParamList, 'Accounts'>;

/** Step 2: add at least one bank account, card, wallet or cash. */
export function AccountsStep({ navigation }: Props) {
  const accounts = useAccounts();
  const items = accounts.data ?? [];

  return (
    <OnboardingFrame
      step={2}
      title="Which accounts do you use?"
      subtitle="Add the bank accounts, cards and wallets you pay from. You can add more later."
      onBack={navigation.goBack}
      footer={<Button block label="Continue" disabled={items.length === 0} onPress={() => navigation.navigate('Source')} />}
    >
      {items.length > 0 && (
        <Card padding="rows">
          {items.map((a, i) => (
            <ListRow
              key={a.id}
              label={a.bankName}
              value={a.maskedNumber ? `${kindLabel(a.kind)} ·· ${a.maskedNumber}` : kindLabel(a.kind)}
              last={i === items.length - 1}
            />
          ))}
        </Card>
      )}
      <AccountForm />
    </OnboardingFrame>
  );
}
