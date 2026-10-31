import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fonts, radius, space, useTheme } from '../theme';
import { Icon, Tag, Text, type IconName, type TagTone } from '../ui';

export interface ImportStatusRowProps {
  fileName: string;
  /** "3 Nov · 142 added, 18 duplicates". */
  subtitle: string;
  tag: { label: string; tone: TagTone };
  onPress?: () => void;
  /** "statement" (default) for files, "sms" for the Bank SMS source. */
  icon?: IconName;
}

/** One source line on Imports: icon, name, what happened, and a status tag. */
export function ImportStatusRow({ fileName, subtitle, tag, onPress, icon = 'statement' }: ImportStatusRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${fileName}, ${subtitle}, ${tag.label}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: colors.background }]}>
        <Icon name={icon} color={colors.textMuted} />
      </View>
      <View style={styles.text}>
        <Text variant="body" numberOfLines={1} style={styles.name}>
          {fileName}
        </Text>
        <Text variant="secondary" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Tag label={tag.label} tone={tag.tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60 },
  pressed: { opacity: 0.7 },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold },
});
