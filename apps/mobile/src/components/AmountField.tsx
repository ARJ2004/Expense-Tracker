import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { formatINR, toPaise } from '@et/domain';
import { fonts, radius, space, useTheme } from '../theme';
import { Text } from '../ui';

export interface AmountFieldProps {
  /** Whole rupees as typed, digits only ("" when empty). Convert with toPaise() when saving. */
  value: string;
  onChange: (digits: string) => void;
  accessibilityLabel: string;
  /** Default 9 digits (₹99,99,99,999). */
  maxDigits?: number;
  autoFocus?: boolean;
}

/**
 * Big rupee entry card from the onboarding mockup: ₹, the grouped amount in mono and a cursor.
 * A hidden number-pad input takes the keystrokes, so only digits ever reach the value.
 */
export function AmountField({ value, onChange, accessibilityLabel, maxDigits = 9, autoFocus = false }: AmountFieldProps) {
  const { colors } = useTheme();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(autoFocus);
  const display = value === '' ? '0' : formatINR(toPaise(value), { symbol: false, decimals: 'auto' });

  return (
    <Pressable accessible={false} onPress={() => input.current?.focus()}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: focused ? colors.accent : colors.border }]}>
        <Text style={[styles.symbol, { color: colors.textMuted }]}>₹</Text>
        <Text variant="hero" style={value === '' && { color: colors.textMuted }}>
          {display}
        </Text>
        {focused && <View style={[styles.cursor, { backgroundColor: colors.accent }]} />}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: value === '' ? 'empty' : `₹${display}` }}
        autoFocus={autoFocus}
        caretHidden
        keyboardType="number-pad"
        maxLength={maxDigits}
        onBlur={() => setFocused(false)}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxDigits))}
        onFocus={() => setFocused(true)}
        style={styles.hidden}
        value={value}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.lg,
    paddingHorizontal: 22,
    borderRadius: radius.card,
    borderWidth: 2,
  },
  symbol: { fontFamily: fonts.monoMedium, fontSize: 28, lineHeight: 36 },
  cursor: { width: 2, height: 36 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
