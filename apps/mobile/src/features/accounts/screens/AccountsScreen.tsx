import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Account } from '@et/api-client';
import { errorMessage } from '../../../lib';
import type { MainStackParamList } from '../../../lib';
import { BottomSheet, Button, Card, ListRow, Screen, Text, TopBar } from '../../../ui';
import { AccountForm } from '../components/AccountForm';
import { useAccounts, useDeleteAccount } from '../hooks';
import { accountName, kindLabel } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'Accounts'>;

/** Settings → Accounts: list, add, edit, delete. Uses the same form as onboarding. */
export function AccountsScreen({ navigation }: Props) {
  const accounts = useAccounts();
  const remove = useDeleteAccount();
  const [editing, setEditing] = useState<Account | null>(null);
  const items = accounts.data ?? [];

  const confirmDelete = (a: Account) =>
    Alert.alert(`Delete ${accountName(a)}?`, 'Accounts with transactions can’t be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(a.id, {
            onSuccess: () => setEditing(null),
            onError: (e) => Alert.alert('Not deleted', errorMessage(e)),
          }),
      },
    ]);

  return (
    <Screen>
      <TopBar title="Accounts" onBack={navigation.goBack} />
      {items.length > 0 && (
        <Card padding="rows">
          {items.map((a, i) => (
            <ListRow key={a.id} label={accountName(a)} value={kindLabel(a.kind)} onPress={() => setEditing(a)} last={i === items.length - 1} />
          ))}
        </Card>
      )}
      {accounts.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(accounts.error)}
        </Text>
      )}
      <Text variant="heading" accessibilityRole="header">
        Add an account
      </Text>
      <AccountForm />
      <BottomSheet visible={editing !== null} onClose={() => setEditing(null)} title="Edit account">
        {editing && (
          <>
            <AccountForm key={editing.id} account={editing} onSaved={() => setEditing(null)} />
            <Button variant="danger" label="Delete account" loading={remove.isPending} onPress={() => confirmDelete(editing)} />
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}
