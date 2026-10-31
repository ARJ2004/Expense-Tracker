import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { radius, space, typeScale, useTheme } from '../theme';
import { Text } from './Text';

export interface TextFieldProps
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'maxLength' | 'autoCapitalize' | 'autoFocus' | 'onSubmitEditing' | 'returnKeyType' | 'secureTextEntry' | 'autoComplete' | 'autoCorrect'
  > {
  label: string;
  /** Shown under the field in the spend colour; also marks the field invalid for screen readers. */
  error?: string;
  hint?: string;
}

/** Labelled single-line input on the surface colour; accent border while focused. */
export function TextField({ label, error, hint, ...input }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.spend : focused ? colors.accent : colors.border;
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        style={[styles.input, typeScale.body, { color: colors.text, backgroundColor: colors.surface, borderColor }]}
      />
      {(error || hint) && (
        <Text variant="secondary" tone={error ? 'spend' : 'muted'}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.md },
});
