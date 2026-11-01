import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fonts, radius, space, useTheme } from '../theme';
import { Icon, Text } from '../ui';
import { applyKey, type KeypadKey } from './keypad';

export interface AmountKeypadProps {
  /** The typed rupee string ("486.5"). */
  value: string;
  onChange: (value: string) => void;
}

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

/** 3×4 number pad from the Add mockup. Enforces the money rules in applyKey(). */
export function AmountKeypad({ value, onChange }: AmountKeypadProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Delete digit' : key === '.' ? 'Decimal point' : key}
              onPress={() => onChange(applyKey(value, key))}
              onLongPress={key === 'back' ? () => onChange('') : undefined}
              style={({ pressed }) => [styles.key, { backgroundColor: pressed ? colors.track : colors.background }]}
            >
              {key === 'back' ? (
                <Icon name="backspace" color={colors.text} size={24} />
              ) : (
                <Text style={styles.digit}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.xs },
  // Rows of flex:1 keys: three always fit, where a % width plus gaps wrapped on narrow phones.
  row: { flexDirection: 'row', gap: space.xs },
  key: { flex: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.monoSemibold, fontSize: 22, lineHeight: 28 },
});
