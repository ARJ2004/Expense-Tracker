import React, { useState } from 'react';
import { normalizeInviteCode } from '@et/domain';
import { BottomSheet, Button, Text, TextField } from '../../../ui';

export interface JoinWithCodeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the cleaned-up code ("K7Q2M9XP4R"). */
  onCode: (code: string) => void;
}

/** For when a link didn't open the app: type or paste the code (or the whole link). */
export function JoinWithCodeSheet({ visible, onClose, onCode }: JoinWithCodeSheetProps) {
  const [text, setText] = useState('');
  const code = normalizeInviteCode(text);
  const submit = () => {
    if (!code) return;
    setText('');
    onClose();
    onCode(code);
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Join with code">
      <Text variant="secondary" tone="muted">
        Enter the 10-character code from the invite, like K7Q2-M9XP4R. You can paste the whole link too.
      </Text>
      <TextField
        label="Code"
        placeholder="K7Q2-M9XP4R"
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={80}
        returnKeyType="go"
        onSubmitEditing={submit}
        error={text.length >= 10 && !code ? 'That doesn’t look like a code. Check it and try again.' : undefined}
      />
      <Button block label="Continue" disabled={!code} onPress={submit} />
    </BottomSheet>
  );
}
