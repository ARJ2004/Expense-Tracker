import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { GroupMember, GroupSplitMode } from '@et/api-client';
import { splitEqually, validateExactSplit } from '@et/domain';
import { fonts, radius, space, useTheme } from '../../../theme';
import { Card, ChipMultiGroup, SegmentedControl, Tag, Text } from '../../../ui';
import { memberName, rupees } from '../labels';

const MODES = [
  { value: 'equal', label: 'Split equally' },
  { value: 'exact', label: 'Exact amounts' },
] as const;

export interface SplitEditorProps {
  members: readonly GroupMember[];
  amountPaise: number;
  mode: GroupSplitMode;
  onModeChange: (mode: GroupSplitMode) => void;
  /** Equal split: who shares it. */
  sharedBy: readonly string[];
  onSharedByChange: (ids: string[]) => void;
  /** Exact split: rupees as typed, per member id ("" = not sharing). */
  exact: Readonly<Record<string, string>>;
  onExactChange: (memberId: string, rupees: string) => void;
}

/** Rupees typed into an exact share ("480", "33.5") as paise; "" and bad input are 0. */
export function sharePaise(typed: string | undefined): number {
  if (!typed) return 0;
  const m = /^(\d{0,9})(?:\.(\d{0,2}))?$/.exec(typed);
  if (!m) return 0;
  return Number(m[1] || '0') * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Keeps digits and one decimal point with up to two decimals. */
function cleanRupees(text: string): string {
  const [whole = '', ...rest] = text.replace(/[^\d.]/g, '').split('.');
  const w = whole.replace(/^0+(?=\d)/, '').slice(0, 9);
  return rest.length ? `${w || '0'}.${rest.join('').slice(0, 2)}` : w;
}

/**
 * Equal or exact split. Equal: pick who shares it and see each person's amount as you go (the
 * same splitEqually the API uses). Exact: an amount per person, with what's left or over.
 */
export function SplitEditor({ members, amountPaise, mode, onModeChange, sharedBy, onSharedByChange, exact, onExactChange }: SplitEditorProps) {
  const { colors } = useTheme();
  const options = members.map((m) => ({ value: m.id, label: memberName(m) }));
  const inOrder = members.filter((m) => sharedBy.includes(m.id)).map((m) => m.id);
  const preview = amountPaise > 0 && inOrder.length > 0 ? splitEqually(amountPaise, inOrder) : [];
  const shares = members.map((m) => ({ memberId: m.id, sharePaise: sharePaise(exact[m.id]) }));
  const check = validateExactSplit(amountPaise, shares);
  const sharedSoFar = amountPaise - (check.ok ? 0 : check.diffPaise);

  return (
    <View style={styles.wrap}>
      <SegmentedControl accessibilityLabel="How to split" options={MODES} value={mode} onChange={onModeChange} />
      {mode === 'equal' ? (
        <>
          <Text variant="label" tone="muted">
            Split between · {inOrder.length} of {members.length}
          </Text>
          <ChipMultiGroup accessibilityLabel="Who shares it" options={options} values={sharedBy} onChange={onSharedByChange} />
          {preview.length > 0 && (
            <Card>
              <View style={styles.head}>
                <Text variant="bodyStrong">Each pays</Text>
                <Text variant="secondary" tone="muted" style={styles.mono}>
                  {rupees(amountPaise)} ÷ {preview.length}
                </Text>
              </View>
              {preview.map((s, i) => (
                <View key={s.memberId} style={[styles.line, i < preview.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <Text>{memberName(members.find((m) => m.id === s.memberId))}</Text>
                  <Text style={styles.amount}>{rupees(s.sharePaise)}</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      ) : (
        <>
          <View style={styles.head}>
            <Text variant="label" tone="muted">
              Each person’s amount
            </Text>
            {amountPaise > 0 && !check.ok && (
              <Tag tone={check.diffPaise > 0 ? 'warning' : 'error'} label={`${rupees(check.diffPaise)} ${check.diffPaise > 0 ? 'left' : 'over'}`} />
            )}
          </View>
          <Card>
            {members.map((m, i) => (
              <View key={m.id} style={[styles.line, i < members.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text variant="bodyStrong">{memberName(m)}</Text>
                <View style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text tone="muted" style={styles.symbol}>
                    ₹
                  </Text>
                  <TextInput
                    accessibilityLabel={`${memberName(m)}'s share in rupees`}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    selectionColor={colors.accent}
                    value={exact[m.id] ?? ''}
                    onChangeText={(t) => onExactChange(m.id, cleanRupees(t))}
                    style={[styles.field, { color: colors.text }]}
                  />
                </View>
              </View>
            ))}
          </Card>
          {amountPaise > 0 && (
            <Text variant="secondary" tone={check.ok ? 'accent' : 'muted'} accessibilityLiveRegion="polite">
              {check.ok ? 'Adds up to the total' : `Split adds up to ${rupees(sharedSoFar)} of ${rupees(amountPaise)}`}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  line: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mono: { fontFamily: fonts.monoMedium },
  amount: { fontFamily: fonts.monoSemibold, fontSize: 15 },
  input: { width: 116, height: 40, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, gap: 4 },
  symbol: { fontFamily: fonts.monoMedium },
  field: { flex: 1, minWidth: 0, fontFamily: fonts.monoSemibold, fontSize: 15, padding: 0, textAlign: 'right' },
});
