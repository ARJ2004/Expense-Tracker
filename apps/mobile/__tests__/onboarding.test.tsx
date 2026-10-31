import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

const bodies: unknown[] = [];
(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const body = await req.json();
  bodies.push(body);
  const me = { id: 'u1', email: 'a@b.co', name: null, onboarded: true, currency: 'INR', timezone: 'Asia/Kolkata', monthlyIncomePaise: body.monthlyIncomePaise ?? null, incomeFrequency: body.incomeFrequency ?? null };
  return new Response(JSON.stringify(me), { status: 200, headers: { 'Content-Type': 'application/json' } });
});

// Required after the fetch mock so openapi-fetch picks it up.
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { useSession } = require('../src/features/auth') as typeof import('../src/features/auth');
const { useCompleteOnboarding } = require('../src/features/onboarding/hooks') as typeof import('../src/features/onboarding/hooks');
const { useOnboardingDraft } = require('../src/features/onboarding/draft') as typeof import('../src/features/onboarding/draft');

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  bodies.length = 0;
  useOnboardingDraft.getState().reset();
});

it('sends typed rupees as integer paise with the frequency, then marks the user onboarded', async () => {
  useOnboardingDraft.setState({ incomeDigits: '75000', frequency: 'monthly' });
  const { result } = await renderHook(() => useCompleteOnboarding(), { wrapper });
  await act(async () => {
    result.current.mutate();
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(bodies[0]).toEqual({ monthlyIncomePaise: 7_500_000, incomeFrequency: 'monthly' });
  expect(useSession.getState().user?.onboarded).toBe(true);
  expect(useOnboardingDraft.getState().incomeDigits).toBe('');
});

it('sends an empty body when income was skipped', async () => {
  useOnboardingDraft.getState().skipIncome();
  const { result } = await renderHook(() => useCompleteOnboarding(), { wrapper });
  await act(async () => {
    result.current.mutate();
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(bodies[0]).toEqual({});
});
