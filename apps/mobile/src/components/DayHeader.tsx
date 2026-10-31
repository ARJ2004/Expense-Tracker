import React from 'react';
import { StyleSheet } from 'react-native';
import { SectionLabel } from '../ui';
import { AmountText } from './AmountText';

export interface DayHeaderProps {
  /** "Today", "Yesterday · 30 Oct", "29 Oct". */
  label: string;
  /** The day's net in paise: credits minus debits; negative shows "−". */
  netPaise: number;
}

/** Ledger day header (locked Transactions mockup): day on the left, signed day total on the right. */
export function DayHeader({ label, netPaise }: DayHeaderProps) {
  return (
    <SectionLabel
      label={label}
      trailing={
        <AmountText
          paise={Math.abs(netPaise)}
          direction={netPaise < 0 ? 'debit' : netPaise > 0 ? 'credit' : undefined}
          tone="muted"
          decimals="always"
          symbol={false}
          style={styles.total}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 13 },
});
