import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { ChipGroup, ProgressBar, TextField, TopBar } from '../src/ui';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

describe('ChipGroup', () => {
  const options = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
  ] as const;

  it.each(['light', 'dark'] as const)('marks the chosen chip selected (%s)', async (scheme) => {
    const onChange = jest.fn();
    await wrap(<ChipGroup accessibilityLabel="Pay frequency" options={options} value="weekly" onChange={onChange} />, scheme);
    expect(screen.getByRole('radio', { name: 'Weekly' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Monthly' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Monthly' }));
    expect(onChange).toHaveBeenCalledWith('monthly');
  });
});

describe('ProgressBar', () => {
  it('reports progress as a percentage', async () => {
    await wrap(<ProgressBar value={1 / 3} segments={3} accessibilityLabel="Step 1 of 3" />);
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 3' })).toHaveAccessibilityValue({ now: 33 });
  });

  it('clamps out-of-range values', async () => {
    await wrap(<ProgressBar value={1.4} accessibilityLabel="Budget" surface="hero" />, 'dark');
    expect(screen.getByRole('progressbar', { name: 'Budget' })).toHaveAccessibilityValue({ now: 100 });
  });
});

describe('TopBar', () => {
  it('shows a labelled back button only when onBack is given', async () => {
    const onBack = jest.fn();
    await wrap(<TopBar title="Review" onBack={onBack} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Review' })).toBeTruthy();
  });
});

describe('TextField', () => {
  it('is labelled and announces its error', async () => {
    const onChangeText = jest.fn();
    await wrap(<TextField label="Bank or wallet" value="" onChangeText={onChangeText} error="Enter the bank or wallet name" />);
    const input = screen.getByLabelText('Bank or wallet');
    await fireEvent.changeText(input, 'HDFC Bank');
    expect(onChangeText).toHaveBeenCalledWith('HDFC Bank');
    expect(screen.getByText('Enter the bank or wallet name')).toBeTruthy();
  });
});
