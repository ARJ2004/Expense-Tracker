import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AccountKind } from '@et/api-client';
import { POPULAR_BANKS } from '@et/domain';
import { errorMessage } from '../../../lib';
import { space } from '../../../theme';
import { Button, Chip, ChipGroup, Text, TextField } from '../../../ui';
import { useCreateAccount } from '../hooks';
import { KIND_OPTIONS } from '../labels';

const QUICK_BANKS = POPULAR_BANKS.slice(0, 6);

/** Bank, kind and optional last 4 digits. Only the last 4 are ever asked for or stored. */
export function AccountForm() {
  const create = useCreateAccount();
  const [bankName, setBankName] = useState('');
  const [kind, setKind] = useState<AccountKind>('savings');
  const [last4, setLast4] = useState('');
  const [touched, setTouched] = useState(false);

  const bankError = touched && bankName.trim() === '' ? 'Enter the bank or wallet name' : undefined;
  const last4Error = last4 !== '' && !/^\d{4}$/.test(last4) ? 'Enter exactly 4 digits, or leave it empty' : undefined;

  const submit = () => {
    setTouched(true);
    if (bankName.trim() === '' || last4Error) return;
    create.mutate(
      { bankName: bankName.trim(), kind, ...(last4 ? { maskedNumber: last4 } : {}) },
      {
        onSuccess: () => {
          setBankName('');
          setLast4('');
          setTouched(false);
        },
      },
    );
  };

  return (
    <View style={styles.form}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Popular banks" style={styles.quick}>
        {QUICK_BANKS.map((bank) => (
          <Chip key={bank} label={bank} selected={bankName === bank} onPress={() => setBankName(bank)} />
        ))}
      </View>
      <TextField label="Bank or wallet" placeholder="e.g. HDFC Bank" value={bankName} onChangeText={setBankName} maxLength={60} error={bankError} />
      <Text variant="label" tone="muted">
        Type
      </Text>
      <ChipGroup accessibilityLabel="Account type" options={KIND_OPTIONS} value={kind} onChange={setKind} />
      <TextField
        label="Last 4 digits (optional)"
        placeholder="4821"
        keyboardType="number-pad"
        maxLength={4}
        value={last4}
        onChangeText={(t) => setLast4(t.replace(/\D/g, ''))}
        error={last4Error}
        hint="Only the last 4. We never store full numbers."
      />
      {create.error && (
        <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
          {errorMessage(create.error)}
        </Text>
      )}
      <Button variant="secondary" label="Add account" loading={create.isPending} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, rowGap: space.sm },
});
