import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Me } from '@et/api-client';
import { useSession } from '../src/features/auth';
import { queryClient } from '../src/lib';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { ThemeProvider } from '../src/theme';

const user = (onboarded: boolean): Me => ({
  id: 'u1',
  email: 'asha@example.com',
  name: 'Asha',
  monthlyIncomePaise: null,
  incomeFrequency: null,
  onboarded,
  currency: 'INR',
  timezone: 'Asia/Kolkata',
});

async function renderWith(state: Partial<ReturnType<typeof useSession.getState>>) {
  // boot() would reach for the keychain and network; pin the state instead.
  useSession.setState({ ...state, boot: async () => undefined });
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('RootNavigator', () => {
  it('shows the splash while booting', async () => {
    await renderWith({ status: 'booting', user: null });
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('shows Sign in when signed out', async () => {
    await renderWith({ status: 'signedOut', user: null });
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  });

  it('shows onboarding step 1 when signed in but not onboarded', async () => {
    await renderWith({ status: 'signedIn', user: user(false) });
    expect(await screen.findByRole('header', { name: 'How much do you earn each month?' })).toBeTruthy();
  });

  it('shows the main tabs once onboarded', async () => {
    await renderWith({ status: 'signedIn', user: user(true) });
    expect(await screen.findByRole('button', { name: 'Add transaction' })).toBeTruthy();
  });

  it('offers a retry when offline at launch', async () => {
    await renderWith({ status: 'offline', user: null });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
