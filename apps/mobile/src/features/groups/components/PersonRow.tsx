import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MerchantAvatar, type AvatarTone } from '../../../components';
import { fonts, space, useTheme } from '../../../theme';
import { Icon, Text } from '../../../ui';
import type { BalanceTone } from '../labels';

export interface PersonRowProps {
  /** Initial for the avatar. */
  name: string;
  tone: AvatarTone;
  emoji?: string | null;
  title: string;
  /** Lines the title may take before it's cut short (history sentences need more than one). */
  titleLines?: number;
  subtitle?: string;
  /** Small words beside or above the amount: "owes", "you owe". */
  caption?: string;
  /** Already formatted, with its sign or ₹. */
  amount?: string;
  amountTone?: BalanceTone | 'default';
  /** "stacked": caption over the amount (activity); "inline": caption left of it (balances). */
  layout?: 'inline' | 'stacked';
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Hide the divider under the last row of a card. */
  last?: boolean;
  /** Rows sit in a card (divider, padding) or loose on the background (activity). */
  divider?: boolean;
}

/** Avatar, name and a line under it, and an amount with words on the right. Group screens only. */
export function PersonRow({
  name,
  tone,
  emoji,
  title,
  titleLines = 1,
  subtitle,
  caption,
  amount,
  amountTone = 'default',
  layout = 'inline',
  onPress,
  accessibilityLabel,
  last = false,
  divider = true,
}: PersonRowProps) {
  const { colors } = useTheme();
  const textTone = amountTone === 'default' ? 'default' : amountTone;
  const content = (
    <View style={[styles.row, divider && !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <MerchantAvatar name={name} tone={tone} emoji={emoji} />
      <View style={styles.middle}>
        <Text variant="bodyStrong" numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {layout === 'stacked' ? (
        <View style={styles.stacked}>
          {caption ? (
            <Text variant="label" tone={textTone}>
              {caption}
            </Text>
          ) : null}
          {amount ? (
            <Text tone={textTone} style={styles.amount}>
              {amount}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.inline}>
          {caption ? (
            <Text variant="secondary" tone="muted">
              {caption}
            </Text>
          ) : null}
          {amount ? (
            <Text tone={textTone} style={styles.amount}>
              {amount}
            </Text>
          ) : null}
          {onPress && <Icon name="chevron" size={18} color={colors.textMuted} />}
        </View>
      )}
    </View>
  );
  const label = accessibilityLabel ?? [title, subtitle, caption, amount].filter(Boolean).join(', ');
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  middle: { flex: 1, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stacked: { alignItems: 'flex-end', gap: 2 },
  amount: { fontFamily: fonts.monoSemibold, fontSize: 15 },
});
