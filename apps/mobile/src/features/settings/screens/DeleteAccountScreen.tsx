import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { Button, Card, Screen, Text, TextField, TopBar } from '../../../ui';
import { useDeleteMe, useExportLedger } from '../hooks';

type Props = NativeStackScreenProps<MainStackParamList, 'DeleteAccount'>;

const CONFIRM = 'DELETE';

/** Settings → Delete account: says what goes, offers an export first, and needs DELETE typed. */
export function DeleteAccountScreen({ navigation }: Props) {
  const [typed, setTyped] = useState('');
  const remove = useDeleteMe();
  const exportLedger = useExportLedger();
  return (
    <Screen
      footer={
        <Button
          block
          variant="danger"
          label="Delete my account"
          loading={remove.isPending}
          disabled={typed.trim().toUpperCase() !== CONFIRM}
          onPress={() => remove.mutate(undefined, { onError: (e) => Alert.alert('Not deleted', errorMessage(e)) })}
        />
      }
    >
      <TopBar title="Delete account" onBack={navigation.goBack} />
      <Card>
        <Text variant="bodyStrong">This can't be undone.</Text>
        <Text variant="secondary" tone="muted">
          Your profile, accounts, transactions, imports and categories are deleted from Altus straight away, and you're signed out on
          every device.
        </Text>
        <Button
          variant="secondary"
          label={exportLedger.isPending ? 'Exporting…' : 'Export my data first'}
          disabled={exportLedger.isPending}
          onPress={() => exportLedger.mutate(undefined, { onError: (e) => Alert.alert('Export failed', errorMessage(e)) })}
        />
      </Card>
      <TextField label={`Type ${CONFIRM} to confirm`} value={typed} onChangeText={setTyped} autoCapitalize="characters" placeholder={CONFIRM} />
    </Screen>
  );
}
