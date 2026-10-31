import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { TransactionSummary } from '@et/api-client';
import { AmountEntry, AmountText, SourceList, TransactionRow } from '../src/components';
import { ThemeProvider } from '../src/theme';
import { BottomSheet, ListRow, SegmentedControl, Tag, Text } from '../src/ui';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

describe('SegmentedControl', () => {
  it.each(['light', 'dark'] as const)('selects one option (%s)', async (scheme) => {
    const onChange = jest.fn();
    const options = [
      { value: 'debit', label: 'Debit' },
      { value: 'credit', label: 'Credit' },
    ] as const;
    await wrap(<SegmentedControl accessibilityLabel="Direction" options={options} value="debit" onChange={onChange} />, scheme);
    expect(screen.getByRole('radio', { name: 'Debit' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Credit' }));
    expect(onChange).toHaveBeenCalledWith('credit');
  });
});

describe('Tag', () => {
  it.each(['success', 'warning', 'error', 'neutral'] as const)('renders the %s tone', async (tone) => {
    await wrap(<Tag label="Food & Dining" tone={tone} />);
    expect(screen.getByText('Food & Dining')).toBeTruthy();
  });
});

describe('BottomSheet', () => {
  it('shows its title and closes from the close button', async () => {
    const onClose = jest.fn();
    await wrap(
      <BottomSheet visible title="Add transaction" onClose={onClose}>
        <Text>Body</Text>
      </BottomSheet>,
    );
    expect(screen.getByRole('header', { name: 'Add transaction' })).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ListRow detail variant', () => {
  it('announces label and value together when pressable', async () => {
    await wrap(<ListRow variant="detail" label="Account" value="HDFC Bank ••1234" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Account, HDFC Bank ••1234' })).toBeTruthy();
  });
});

describe('AmountText with direction', () => {
  it('signs debits with − and credits with +', async () => {
    await wrap(<AmountText paise={48_600} direction="debit" decimals="always" />);
    expect(screen.getByText('−₹486.00')).toBeTruthy();
    await wrap(<AmountText paise={48_600} direction="credit" symbol={false} />);
    expect(screen.getByText('+486')).toBeTruthy();
  });
});

describe('AmountEntry', () => {
  it('groups the whole part and keeps typed decimals', async () => {
    await wrap(<AmountEntry value="123456.5" />);
    expect(screen.getByText('1,23,456.5')).toBeTruthy();
  });
});

describe('TransactionRow', () => {
  const txn: TransactionSummary = {
    id: 't1',
    amountPaise: 48_600,
    direction: 'debit',
    type: 'expense',
    occurredAt: new Date().toISOString(),
    merchantName: 'Swiggy',
    category: { id: 'c1', name: 'Food & Dining', icon: 'food', color: 'chart2' },
    account: null,
  };

  it.each(['light', 'dark'] as const)('shows merchant, category and the signed amount (%s)', async (scheme) => {
    const onPress = jest.fn();
    await wrap(<TransactionRow txn={txn} onPress={onPress} />, scheme);
    expect(screen.getByText('−486.00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Swiggy, paid ₹486\.00, Food & Dining/ }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('SourceList', () => {
  it('counts sources', async () => {
    await wrap(<SourceList sources={[{ source: 'manual', receivedAt: new Date().toISOString() }]} />);
    expect(screen.getByRole('header', { name: 'Seen in 1 source' })).toBeTruthy();
    expect(screen.getByText('Added by you')).toBeTruthy();
  });
});
