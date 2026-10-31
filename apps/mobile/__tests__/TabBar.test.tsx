import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootTabs } from '../src/navigation/RootTabs';
import { ThemeProvider } from '../src/theme';

jest.mock('../src/features/settings/hooks', () => ({
  useHealth: () => ({ isPending: false, isError: false, data: { version: '0.0.1' } }),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderTabs() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <NavigationContainer>
            <RootTabs />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('RootTabs', () => {
  it('labels every tab and marks Home as selected first', async () => {
    await renderTabs();
    for (const name of ['Home', 'Transactions', 'Imports', 'Settings']) {
      expect(await screen.findByRole('tab', { name })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('switches to Settings and shows the API health row', async () => {
    await renderTabs();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('ok · v0.0.1')).toBeTruthy();
  });
});
