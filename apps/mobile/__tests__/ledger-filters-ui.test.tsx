import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Account, Category } from '@et/api-client';
import { CategoryPicker, DayHeader } from '../src/components';
import { FilterSheet } from '../src/features/transactions/components/FilterSheet';
import { QuickFilters } from '../src/features/transactions/components/QuickFilters';
import { ThemeProvider } from '../src/theme';
import { ChipMultiGroup, IconButton, SearchField, Toggle } from '../src/ui';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

const FOOD: Category = { id: '00000000-0000-7000-8000-000000000001', name: 'Food & Dining', icon: 'food', color: 'chart2', isExpense: true, system: true };
const GROCERIES: Category = { id: '00000000-0000-7000-8000-000000000002', name: 'Groceries', icon: 'groceries', color: 'chart3', isExpense: true, system: true };
const HDFC: Account = { id: 'a1', bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '1234', nickname: null } as Account;

describe('SearchField', () => {
  it('clears with the clear button', async () => {
    const onChange = jest.fn();
    await wrap(<SearchField value="swig" onChangeText={onChange} placeholder="Search merchant or note" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('has no clear button when empty', async () => {
    await wrap(<SearchField value="" onChangeText={jest.fn()} placeholder="Search" />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});

describe('Toggle', () => {
  it.each(['light', 'dark'] as const)('flips when the row is pressed (%s)', async (scheme) => {
    const onChange = jest.fn();
    await wrap(<Toggle label="Apply to all from Swiggy" value onValueChange={onChange} />, scheme);
    const toggle = screen.getByRole('switch', { name: 'Apply to all from Swiggy' });
    expect(toggle).toBeChecked();
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('ChipMultiGroup', () => {
  it('toggles values on and off', async () => {
    const onChange = jest.fn();
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    await wrap(<ChipMultiGroup accessibilityLabel="Pick" options={options} values={['a']} onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'B' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'A' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe('IconButton badge', () => {
  it('shows a count only when above zero', async () => {
    const { rerender } = await wrap(<IconButton icon="filter" accessibilityLabel="Filters, 2 on" badge={2} />);
    expect(screen.getByText('2')).toBeTruthy();
    await rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <IconButton icon="filter" accessibilityLabel="Filters" badge={0} />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(screen.queryByText('0')).toBeNull();
  });
});

describe('DayHeader', () => {
  it('signs the day total and upper-cases the label', async () => {
    await wrap(<DayHeader label="Yesterday · 30 Oct" netPaise={-1_23_800} />);
    expect(screen.getByText('YESTERDAY · 30 OCT')).toBeTruthy();
    expect(screen.getByText('−1,238.00')).toBeTruthy();
  });

  it('shows + for a positive day', async () => {
    await wrap(<DayHeader label="29 Oct" netPaise={75_00_000} />);
    expect(screen.getByText('+75,000.00')).toBeTruthy();
  });
});

describe('CategoryPicker apply-to-all', () => {
  it('shows the merchant toggle above the chips', async () => {
    const onToggle = jest.fn();
    await wrap(
      <CategoryPicker
        visible
        categories={[FOOD, GROCERIES]}
        value={FOOD.id}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        applyToAll={{ merchant: 'Swiggy', value: true, onChange: onToggle }}
      />,
    );
    await fireEvent.press(screen.getByRole('switch', { name: 'Apply to all from Swiggy' }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('has no toggle without a merchant', async () => {
    await wrap(<CategoryPicker visible categories={[FOOD]} value={FOOD.id} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

describe('QuickFilters', () => {
  it('toggles direction and a single category; All clears both', async () => {
    const onChange = jest.fn();
    const { rerender } = await wrap(<QuickFilters filters={{}} onChange={onChange} categories={[FOOD]} />);
    expect(screen.getByRole('radio', { name: 'All' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Debits' }));
    expect(onChange).toHaveBeenLastCalledWith({ direction: 'debit' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Food & Dining' }));
    expect(onChange).toHaveBeenLastCalledWith({ categoryIds: [FOOD.id] });

    await rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <QuickFilters filters={{ direction: 'debit', categoryIds: [FOOD.id] }} onChange={onChange} categories={[FOOD]} />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Debits' }));
    expect(onChange).toHaveBeenLastCalledWith({ direction: undefined, categoryIds: [FOOD.id] });
    await fireEvent.press(screen.getByRole('radio', { name: 'All' }));
    expect(onChange).toHaveBeenLastCalledWith({ direction: undefined, categoryIds: undefined });
  });
});

describe('FilterSheet', () => {
  const open = (onApply = jest.fn(), value = {}) =>
    wrap(<FilterSheet visible value={value} categories={[FOOD, GROCERIES]} accounts={[HDFC]} onApply={onApply} onClose={jest.fn()} />);

  it('applies categories, account and amounts in paise', async () => {
    const onApply = jest.fn();
    await open(onApply);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Food & Dining' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Groceries' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'HDFC Bank ••1234' }));
    await fireEvent.changeText(screen.getByLabelText('Min ₹'), '100');
    await fireEvent.changeText(screen.getByLabelText('Max ₹'), '499.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Show results' }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: [FOOD.id, GROCERIES.id], accountId: 'a1', minAmountPaise: 10_000, maxAmountPaise: 49_950 }),
    );
  });

  it('blocks a minimum above the maximum and bad amounts', async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText('Min ₹'), '500');
    await fireEvent.changeText(screen.getByLabelText('Max ₹'), '100');
    expect(screen.getByText('Minimum is more than maximum')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show results' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Max ₹'), 'abc');
    expect(screen.getByText('Enter an amount like 500 or 499.50')).toBeTruthy();
  });

  it('starts from the applied filters and clears everything', async () => {
    const onApply = jest.fn();
    await open(onApply, { type: 'income', minAmountPaise: 50_000 });
    expect(screen.getByRole('radio', { name: 'Income' })).toBeSelected();
    expect(screen.getByLabelText('Min ₹').props.value).toBe('500');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear all' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Show results' }));
    expect(onApply).toHaveBeenCalledWith({ q: undefined, minAmountPaise: undefined, maxAmountPaise: undefined, categoryIds: undefined });
  });
});
