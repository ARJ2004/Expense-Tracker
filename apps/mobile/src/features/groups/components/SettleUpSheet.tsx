import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { GroupDetail } from '@et/api-client';
import { istDateKey, toPaise } from '@et/domain';
import { AmountEntry, AmountKeypad, isPositiveAmount } from '../../../components';
import { errorMessage } from '../../../lib';
import { space } from '../../../theme';
import { BottomSheet, Button, ChipGroup, ListRow, Text } from '../../../ui';
import { useRecordPayment } from '../hooks';
import { dateRowLabel, memberName, rupees } from '../labels';

export interface SettleUpDraft {
  fromId: string;
  toId: string;
  amountPaise: number;
}

export interface SettleUpSheetProps {
  group: GroupDetail;
  /** null = closed. A suggested transfer, or an empty draft for "Record a payment". */
  draft: SettleUpDraft | null;
  onClose: () => void;
}

/** Paise as the keypad's typed string: 255000 → "2550", 3334 → "33.34". */
export function typedRupees(paise: number): string {
  if (paise <= 0) return '';
  const whole = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`;
}

/** Records that one member paid another back. Only a record: no money moves. */
export function SettleUpSheet({ group, draft, onClose }: SettleUpSheetProps) {
  const record = useRecordPayment(group.id);
  const today = istDateKey(new Date());
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(today);

  useEffect(() => {
    if (!draft) return;
    setFromId(draft.fromId);
    setToId(draft.toId);
    setAmount(typedRupees(draft.amountPaise));
    setDay(istDateKey(new Date()));
    record.reset();
    // Only when a new draft opens the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const options = group.members.map((m) => ({ value: m.id, label: memberName(m) }));
  const owed = group.transfers.find((t) => t.fromId === fromId && t.toId === toId);
  const from = group.members.find((m) => m.id === fromId);
  const to = group.members.find((m) => m.id === toId);
  const ready = fromId !== '' && toId !== '' && fromId !== toId && isPositiveAmount(amount);

  const pickDay = () =>
    DateTimePickerAndroid.open({
      value: new Date(`${day}T12:00:00+05:30`),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, date) => {
        if (event.type === 'set' && date) setDay(istDateKey(date));
      },
    });

  const save = () => record.mutate({ fromId, toId, amountPaise: toPaise(amount), day }, { onSuccess: onClose });

  return (
    <BottomSheet visible={draft !== null} onClose={onClose} title="Record a payment" height="tall">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} style={styles.scroll}>
        <Text variant="label" tone="muted">
          From
        </Text>
        <ChipGroup scroll accessibilityLabel="Who paid" options={options} value={fromId || null} onChange={setFromId} />
        <Text variant="label" tone="muted">
          To
        </Text>
        <ChipGroup scroll accessibilityLabel="Who was paid" options={options.filter((o) => o.value !== fromId)} value={toId || null} onChange={setToId} />
        <AmountEntry value={amount} />
        {owed && from && to && (
          <Text variant="secondary" tone="muted" style={styles.center}>
            {memberName(from)} {from.isSelf ? 'owe' : 'owes'} {to.isSelf ? 'you' : memberName(to)} {rupees(owed.amountPaise)} in this group
          </Text>
        )}
        <ListRow variant="detail" label="Date" value={dateRowLabel(day, today)} onPress={pickDay} last />
        <AmountKeypad value={amount} onChange={setAmount} />
        <Text variant="secondary" tone="muted">
          This only records a cash or UPI payment between you. It isn’t added to your income or spending.
        </Text>
      </ScrollView>
      {record.error && (
        <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
          {errorMessage(record.error)}
        </Text>
      )}
      <Button block label="Record payment" disabled={!ready} loading={record.isPending} onPress={save} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: space.sm },
  center: { textAlign: 'center' },
});
