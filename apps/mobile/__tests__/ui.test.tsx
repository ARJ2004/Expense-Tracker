import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Button, EmptyState, HeroSurface, IconButton, ListRow, Text } from '../src/ui';
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

  it('draws an icon before the label and keeps the label as its name', async () => {
    await wrap(<Button label="Continue with Google" variant="secondary" icon={<RNText>G</RNText>} />, 'dark');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.getByText('G')).toBeTruthy();
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Save" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('HeroSurface', () => {
  it.each(['light', 'dark'] as const)('draws its content on the hero colour (%s)', async (scheme) => {
    const { altusDark, altusLight } = require('../src/theme') as typeof import('../src/theme');
    await wrap(
      <HeroSurface>
        <Text>Spent this month</Text>
      </HeroSurface>,
      scheme,
    );
    const card = screen.toJSON() as unknown as { props: { style: unknown } };
    const flat = Object.assign({}, ...[card.props.style].flat(2).filter(Boolean));
    expect(flat.backgroundColor).toBe((scheme === 'dark' ? altusDark : altusLight).hero);
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
