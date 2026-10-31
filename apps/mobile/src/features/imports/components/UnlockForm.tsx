import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../../lib';
import { space } from '../../../theme';
import { Button, Card, Text, TextField } from '../../../ui';
import { useUnlockImport } from '../hooks';

export interface UnlockFormProps {
  importId: string;
  fileName: string;
  onDiscard: () => void;
}

/**
 * Asks for a statement PDF's password. Banks usually build it from the name and date of birth;
 * it is sent once to open the file and never saved on the phone or the server.
 */
export function UnlockForm({ importId, fileName, onDiscard }: UnlockFormProps) {
  const unlock = useUnlockImport(importId);
  const [password, setPassword] = useState('');
  const submit = () => {
    if (password.length > 0 && !unlock.isPending) unlock.mutate(password);
  };
  return (
    <Card>
      <View style={styles.body}>
        <Text variant="heading" accessibilityRole="header">
          This PDF has a password
        </Text>
        <Text variant="body" tone="muted">
          {fileName} is locked. Enter the password your bank gave you, often part of your name and date of birth. Altus uses it once to open the file and doesn't keep it.
        </Text>
        <TextField
          label="Statement password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (unlock.error) unlock.reset();
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={128}
          returnKeyType="go"
          onSubmitEditing={submit}
          error={unlock.error ? errorMessage(unlock.error) : undefined}
        />
        <Button block label="Open statement" onPress={submit} loading={unlock.isPending} disabled={password.length === 0} />
        <Button block variant="text" label="Discard" onPress={onDiscard} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
});
