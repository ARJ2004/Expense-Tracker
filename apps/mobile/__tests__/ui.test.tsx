import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, EmptyState, IconButton, ListRow } from '../src/ui';
import { ThemeProvider } from '../src/theme';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

describe('Button', () => {
  it.each(['primary', 'secondary', 'danger', 'text'] as const)('renders the %s variant', async (variant) => {
    const onPress = jest.fn();
    await wrap(<Button label="Save" variant={variant} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Save" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is announced by its label', async () => {
    await wrap(<IconButton icon="filter" accessibilityLabel="Filters" />, 'dark');
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('calls each action handler', async () => {
    const first = jest.fn();
    const second = jest.fn();
    await wrap(<EmptyState title="Empty" message="Nothing yet" actions={[{ label: 'Import', onPress: first }, { label: 'Add', onPress: second }]} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Import' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});

describe('ListRow', () => {
  it('shows label and value', async () => {
    await wrap(<ListRow label="API" value="ok · v0.0.1" last />);
    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByText('ok · v0.0.1')).toBeTruthy();
  });
});
