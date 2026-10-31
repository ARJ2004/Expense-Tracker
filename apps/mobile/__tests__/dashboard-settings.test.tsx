import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { istMonthKey, monthLabel, shiftMonth } from '@et/domain';

const FOOD = { id: 'c1', name: 'Food & Dining', icon: 'food', color: 'chart2' };
const RENT = { id: 'c2', name: 'Rent', icon: 'rent', color: 'chart1' };
const CASH = { id: 'c3', name: 'Cash', icon: 'cash', color: 'chart4' };
const summary = (month: string, over: Partial<Record<string, unknown>> = {}) => ({
  month,
  spendPaise: 4_218_000,
  incomePaise: 7_500_000,
  refundPaise: 119_900,
  netPaise: 3_282_000,
  monthlyIncomePaise: 7_500_000,
  leftToSpendPaise: 3_282_000,
  usedPercent: 56,
  byCategory: [
    { category: RENT, spendPaise: 1_800_000, count: 1 },
    { category: FOOD, spendPaise: 984_000, count: 23 },
    { category: CASH, spendPaise: 200_000, count: 2 },
  ],
  topMerchants: [{ merchantName: 'Swiggy', spendPaise: 486_000, count: 10 }],
  transactionCount: 212,
  hasAnyTransactions: true,
  ...over,
});

const summaryMonths: string[] = [];
const requests: Array<{ method: string; path: string; body?: unknown }> = [];
let summaryOverride: Partial<Record<string, unknown>> = {};

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const url = new URL(req.url);
  const path = url.pathname;
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json();
  requests.push({ method: req.method, path, body });
  if (path === '/v1/dashboard/summary') {
    const month = url.searchParams.get('month')!;
    summaryMonths.push(month);
    return json(200, summary(month, summaryOverride));
  }
  if (path === '/v1/transactions/recent') return json(200, { items: [] });
  if (path === '/v1/me' && req.method === 'PATCH') {
    return json(200, { ...ME, ...(body as object) });
  }
  if (path === '/v1/me' && req.method === 'DELETE') return new Response(null, { status: 204 });
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const ME = { id: 'u1', email: 'adarsh@example.com', name: 'Adarsh R', monthlyIncomePaise: 7_500_000, incomeFrequency: 'monthly', onboarded: true, currency: 'INR', timezone: 'Asia/Kolkata' };

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

// Required after the fetch mock so openapi-fetch picks it up.
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { HomeScreen, CategorySpendScreen } = require('../src/features/home') as typeof import('../src/features/home');
const { heroFigures, barRatio } = require('../src/features/home/summary') as typeof import('../src/features/home/summary');
const { DeleteAccountScreen, IncomeScreen } = require('../src/features/settings') as typeof import('../src/features/settings');
const { exportLedger } = require('../src/features/settings/export') as typeof import('../src/features/settings/export');
const { incomeLabel, initials } = require('../src/features/settings/labels') as typeof import('../src/features/settings/labels');
const { useSession } = require('../src/features/auth') as typeof import('../src/features/auth');
const { usePreferences } = require('../src/lib') as typeof import('../src/lib');
const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');
const picker = require('@react-native-documents/picker') as { saveDocuments: jest.Mock };
const blob = require('react-native-blob-util') as { __state: { next: number[]; requests: Array<{ url: string }>; unlinked: string[] } };

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const providers = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
);
const nav = { navigate: mockNavigate, goBack: jest.fn() } as any;

const current = istMonthKey(new Date());
const year = Number(current.slice(0, 4));

beforeEach(() => {
  summaryMonths.length = 0;
  requests.length = 0;
  summaryOverride = {};
  mockNavigate.mockClear();
  nav.goBack.mockClear();
  useSession.setState({ status: 'signedIn', user: ME as never });
});

describe('heroFigures', () => {
  const base = summary('2026-10') as never;

  it('measures spend against the monthly income', () => {
    expect(heroFigures(base, true, 'October')).toEqual({
      label: 'Spent this month',
      paise: 4_218_000,
      pill: '56% used',
      progress: 0.56,
      stats: [
        { label: 'Income', paise: 7_500_000, tone: 'income' },
        { label: 'Left to spend', paise: 3_282_000 },
      ],
    });
  });

  it('says "Over by" once spend passes income, and names past months', () => {
    const over = heroFigures({ ...summary('2026-09'), leftToSpendPaise: -50_000, usedPercent: 101 } as never, false, 'September');
    expect(over.label).toBe('Spent in September');
    expect(over.stats?.[1]).toEqual({ label: 'Over by', paise: 50_000 });
  });

  it('shows income received and the net when no income is set', () => {
    const h = heroFigures({ ...summary('2026-10'), monthlyIncomePaise: null, leftToSpendPaise: null, usedPercent: null, netPaise: -10_000 } as never, true, 'October');
    expect(h.pill).toBeUndefined();
    expect(h.progress).toBeUndefined();
    expect(h.stats).toEqual([
      { label: 'Income', paise: 7_500_000, tone: 'income' },
      { label: 'Overspent', paise: 10_000 },
    ]);
  });

  it('sizes bars against the largest category', () => {
    expect(barRatio(984_000, 1_800_000)).toBeCloseTo(0.5467, 3);
    expect(barRatio(5, 0)).toBe(0);
  });
});

describe('settings labels', () => {
  it('formats income and initials', () => {
    expect(incomeLabel(7_500_000)).toBe('₹75,000 / month');
    expect(incomeLabel(null)).toBe('Not set');
    expect(incomeLabel(0)).toBe('Not set');
    expect(initials('Adarsh R', 'a@x.in')).toBe('AR');
    expect(initials('  asha  ', undefined)).toBe('A');
    expect(initials(null, 'zed@x.in')).toBe('Z');
  });
});

describe('HomeScreen', () => {
  it('shows the hero card and the top categories for the current month', async () => {
    await render(providers(<HomeScreen />));
    expect(await screen.findByText('₹42,180')).toBeTruthy();
    expect(screen.getByText('56% used')).toBeTruthy();
    expect(screen.getByText('75,000')).toBeTruthy();
    expect(screen.getByText('32,820')).toBeTruthy();
    expect(screen.getByLabelText('Rent, ₹18,000')).toBeTruthy();
    expect(screen.getByLabelText('Food & Dining, ₹9,840')).toBeTruthy();
    expect(summaryMonths).toEqual([current]);
    // No arrow into the future.
    expect(screen.queryByLabelText(`Show ${monthLabel(shiftMonth(current, 1), year)}`)).toBeNull();
  });

  it('steps back a month and forward again', async () => {
    await render(providers(<HomeScreen />));
    await screen.findByText('₹42,180');
    const previous = shiftMonth(current, -1);
    await fireEvent.press(screen.getByLabelText(`Show ${monthLabel(previous, year)}`));
    expect(await screen.findByText(`Your ${monthLabel(previous, year)}`)).toBeTruthy();
    await waitFor(() => expect(summaryMonths).toContain(previous));
    expect(await screen.findByText(`Spent in ${monthLabel(previous, year)}`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(`Show ${monthLabel(current, year)}`));
    expect(await screen.findByText(`Your ${monthLabel(current, year)}`)).toBeTruthy();
  });

  it('opens the full list from See all', async () => {
    await render(providers(<HomeScreen />));
    await fireEvent.press(await screen.findByRole('button', { name: 'See all categories' }));
    expect(mockNavigate).toHaveBeenCalledWith('CategorySpend', { month: current });
  });

  it('keeps the empty state until the first transaction', async () => {
    summaryOverride = { hasAnyTransactions: false, spendPaise: 0, byCategory: [], topMerchants: [] };
    await render(providers(<HomeScreen />));
    expect(await screen.findByText('No transactions yet')).toBeTruthy();
    expect(screen.queryByText('Where it went')).toBeNull();
  });
});

describe('CategorySpendScreen', () => {
  it('lists every category with its count, then top merchants', async () => {
    await render(providers(<CategorySpendScreen navigation={nav} route={{ key: 'k', name: 'CategorySpend', params: { month: '2026-10' } }} />));
    expect(await screen.findByLabelText('Cash, ₹2,000, 2 payments')).toBeTruthy();
    expect(screen.getByLabelText('Food & Dining, ₹9,840, 23 payments')).toBeTruthy();
    expect(screen.getByLabelText('Swiggy, ₹4,860, 10 payments')).toBeTruthy();
    expect(screen.getByText(/after ₹1,199.00 in refunds/)).toBeTruthy();
  });
});

describe('IncomeScreen', () => {
  it('saves the income in paise and updates the session', async () => {
    await render(providers(<IncomeScreen navigation={nav} route={{ key: 'k', name: 'Income' }} />));
    await fireEvent.changeText(screen.getByLabelText('Monthly income in rupees'), '90000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
    expect(requests.find((r) => r.method === 'PATCH')?.body).toEqual({ monthlyIncomePaise: 9_000_000, incomeFrequency: 'monthly' });
    expect(useSession.getState().user?.monthlyIncomePaise).toBe(9_000_000);
  });
});

describe('DeleteAccountScreen', () => {
  it('needs DELETE typed, then deletes and signs out', async () => {
    await render(providers(<DeleteAccountScreen navigation={nav} route={{ key: 'k', name: 'DeleteAccount' }} />));
    const button = screen.getByRole('button', { name: 'Delete my account' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByPlaceholderText('DELETE'), 'delete');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
    expect(requests.some((r) => r.method === 'DELETE' && r.path === '/v1/me')).toBe(true);
  });
});

describe('exportLedger', () => {
  beforeEach(() => {
    blob.__state.next = [200];
    blob.__state.requests.length = 0;
    blob.__state.unlinked.length = 0;
    picker.saveDocuments.mockClear();
  });

  it('downloads to the cache, opens Save as, then removes the cache copy', async () => {
    await expect(exportLedger()).resolves.toBe(true);
    expect(blob.__state.requests[0]?.url).toMatch(/\/v1\/me\/export$/);
    const args = picker.saveDocuments.mock.calls[0][0];
    expect(args.mimeType).toBe('text/csv');
    expect(args.fileName).toMatch(/^altus-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(blob.__state.unlinked).toEqual([`/cache/${args.fileName}`]);
  });

  it('resolves false when Save as is cancelled', async () => {
    picker.saveDocuments.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { code: 'OPERATION_CANCELED' }));
    await expect(exportLedger()).resolves.toBe(false);
    expect(blob.__state.unlinked).toHaveLength(1);
  });

  it('fails without opening Save as when the API refuses', async () => {
    blob.__state.next = [429];
    await expect(exportLedger()).rejects.toMatchObject({ code: 'EXPORT_FAILED' });
    expect(picker.saveDocuments).not.toHaveBeenCalled();
  });
});

describe('appearance', () => {
  it('stores the choice on the phone', async () => {
    await act(async () => usePreferences.getState().setAppearance('dark'));
    expect(usePreferences.getState().appearance).toBe('dark');
    await act(async () => usePreferences.getState().setAppearance('system'));
  });
});
