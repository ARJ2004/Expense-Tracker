import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, touchTarget, typeScale, useTheme } from '../theme';
import { Icon } from './Icon';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
}

/** Pill search input (locked Transactions mockup): magnifier, text, a clear button once typed in. */
export function SearchField({ value, onChangeText, placeholder, maxLength = 60 }: SearchFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="search" color={colors.textMuted} size={20} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
        accessibilityLabel={placeholder}
        accessibilityRole="search"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        style={[styles.input, typeScale.body, { color: colors.text }]}
      />
      {value.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} style={styles.clear}>
          <Icon name="close" color={colors.textMuted} size={18} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 48, borderRadius: radius.pill, borderWidth: 1, paddingLeft: space.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, height: '100%', paddingVertical: 0 },
  clear: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
});
