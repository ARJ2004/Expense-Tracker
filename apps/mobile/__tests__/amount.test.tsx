import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { paise } from '@et/domain';
import { AmountField, AmountText } from '../src/components';
import { ThemeProvider } from '../src/theme';

function Harness({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <AmountField
      accessibilityLabel="Monthly income in rupees"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('AmountField', () => {
  it('keeps only digits and shows Indian grouping', async () => {
    const onValue = jest.fn();
    await render(
      <ThemeProvider>
        <Harness onValue={onValue} />
      </ThemeProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Monthly income in rupees'), '01,23,456.7');
    expect(onValue).toHaveBeenLastCalledWith('1234567');
    expect(screen.getByText('12,34,567')).toBeTruthy();
  });

  it('shows 0 when empty', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <AmountField accessibilityLabel="Amount" value="" onChange={jest.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('AmountText', () => {
  const renderAmount = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

  it('formats paise with the rupee sign', async () => {
    await renderAmount(<AmountText paise={paise(4_860_050)} />);
    expect(screen.getByText('₹48,600.50')).toBeTruthy();
  });

  it('signs spends and income so colour is not the only cue', async () => {
    await renderAmount(<AmountText paise={paise(48_600)} tone="spend" />);
    expect(screen.getByText('−₹486')).toBeTruthy();
    await renderAmount(<AmountText paise={paise(48_600)} tone="income" />);
    expect(screen.getByText('+₹486')).toBeTruthy();
  });
});
