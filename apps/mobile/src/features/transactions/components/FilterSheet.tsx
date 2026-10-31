import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Account, Category } from '@et/api-client';
import { formatINR, toPaise, type LedgerFilters, type SourceKind, type TxnType } from '@et/domain';
import { CategoryIcon } from '../../../components';
import { space } from '../../../theme';
import { BottomSheet, Button, ChipGroup, ChipMultiGroup, SectionLabel, Text, TextField } from '../../../ui';
import { accountName } from '../../accounts';
import { presetOf, presetRange, type DatePreset } from '../ledger';

export interface FilterSheetProps {
  visible: boolean;
  value: LedgerFilters;
  categories: readonly Category[];
  accounts: readonly Account[];
  onApply: (filters: LedgerFilters) => void;
  onClose: () => void;
}

const ANY = 'any';
const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90_days', label: 'Last 90 days' },
];
const TYPE_OPTIONS: { value: TxnType | typeof ANY; label: string }[] = [
  { value: ANY, label: 'Any' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'refund', label: 'Refund' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'atm_withdrawal', label: 'ATM withdrawal' },
  { value: 'cash_deposit', label: 'Cash deposit' },
];
const SOURCE_OPTIONS: { value: SourceKind | typeof ANY; label: string }[] = [
  { value: ANY, label: 'Any' },
  { value: 'manual', label: 'Added by you' },
  { value: 'statement', label: 'Statement' },
  { value: 'sms', label: 'SMS' },
  { value: 'notification', label: 'Notification' },
];

/** Rupees typed by the user → paise; empty is "no limit", anything unparseable is an error. */
function parseRupees(text: string): { paise?: number; error?: string } {
  if (text.trim() === '') return {};
  try {
    const p = toPaise(text);
    return p > 0 ? { paise: p } : { error: 'Enter more than ₹0' };
  } catch {
    return { error: 'Enter an amount like 500 or 499.50' };
  }
}

const rupeesText = (p?: number) => (p === undefined ? '' : formatINR(p, { symbol: false, decimals: 'auto' }).replace(/,/g, ''));

/** "Filters" sheet: date range, categories, type, source, account and amount. Applied together. */
export function FilterSheet({ visible, value, categories, accounts, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<LedgerFilters>(value);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  // Start from the applied filters each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMin(rupeesText(value.minAmountPaise));
    setMax(rupeesText(value.maxAmountPaise));
  }, [visible, value]);

  const minParsed = parseRupees(min);
  const maxParsed = parseRupees(max);
  const rangeError =
    minParsed.paise !== undefined && maxParsed.paise !== undefined && minParsed.paise > maxParsed.paise ? 'Minimum is more than maximum' : undefined;
  const invalid = Boolean(minParsed.error || maxParsed.error || rangeError);

  const apply = () =>
    onApply({
      ...draft,
      q: undefined,
      minAmountPaise: minParsed.paise,
      maxAmountPaise: maxParsed.paise,
      categoryIds: draft.categoryIds?.length ? draft.categoryIds : undefined,
    });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filters" height="tall">
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionLabel label="When" />
        <ChipGroup
          accessibilityLabel="When"
          options={DATE_OPTIONS}
          value={presetOf(draft)}
          onChange={(p) => setDraft({ ...draft, from: undefined, to: undefined, ...presetRange(p) })}
        />

        <SectionLabel label="Categories" />
        <ChipMultiGroup
          accessibilityLabel="Categories"
          options={categories.map((c) => ({ value: c.id, label: c.name, renderIcon: (tint: string) => <CategoryIcon icon={c.icon} tint={tint} /> }))}
          values={draft.categoryIds ?? []}
          onChange={(ids) => setDraft({ ...draft, categoryIds: ids })}
        />

        <SectionLabel label="Type" />
        <ChipGroup accessibilityLabel="Type" options={TYPE_OPTIONS} value={draft.type ?? ANY} onChange={(t) => setDraft({ ...draft, type: t === ANY ? undefined : t })} />

        <SectionLabel label="Source" />
        <ChipGroup
          accessibilityLabel="Source"
          options={SOURCE_OPTIONS}
          value={draft.source ?? ANY}
          onChange={(s) => setDraft({ ...draft, source: s === ANY ? undefined : s })}
        />

        {accounts.length > 0 && (
          <>
            <SectionLabel label="Account" />
            <ChipGroup
              accessibilityLabel="Account"
              options={[{ value: ANY, label: 'Any' }, ...accounts.map((a) => ({ value: a.id, label: accountName(a) }))]}
              value={draft.accountId ?? ANY}
              onChange={(id) => setDraft({ ...draft, accountId: id === ANY ? undefined : id })}
            />
          </>
        )}

        <SectionLabel label="Amount" />
        <View style={styles.amounts}>
          <View style={styles.fill}>
            <TextField label="Min ₹" value={min} onChangeText={setMin} keyboardType="decimal-pad" placeholder="0" error={minParsed.error} />
          </View>
          <View style={styles.fill}>
            <TextField label="Max ₹" value={max} onChangeText={setMax} keyboardType="decimal-pad" placeholder="No limit" error={maxParsed.error} />
          </View>
        </View>
        {rangeError && (
          <Text variant="secondary" tone="spend">
            {rangeError}
          </Text>
        )}
      </ScrollView>
      <View style={styles.actions}>
        <View style={styles.fill}>
          <Button
            block
            variant="secondary"
            label="Clear all"
            onPress={() => {
              setDraft({});
              setMin('');
              setMax('');
            }}
          />
        </View>
        <View style={styles.fill}>
          <Button block label="Show results" disabled={invalid} onPress={apply} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: space.sm, paddingBottom: space.md },
  amounts: { flexDirection: 'row', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
});
