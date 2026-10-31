import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { space, typeScale, useTheme } from '../../../theme';
import { Text } from '../../../ui';

export interface FieldRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength: number;
  last?: boolean;
}

/**
 * A ListRow-shaped row with an inline text input on the right (Paid to, Note).
 * Feature-local: only the Add sheet needs typing inside a row.
 */
export function FieldRow({ label, value, onChangeText, placeholder, maxLength, last = false }: FieldRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text tone="muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        maxLength={maxLength}
        returnKeyType="done"
        style={[styles.input, typeScale.bodyStrong, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  input: { flex: 1, textAlign: 'right', paddingVertical: space.xs },
});
