import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const FOOD = { id: '00000000-0000-7000-8000-000000000001', name: 'Food & Dining', icon: 'food', color: 'chart2', isExpense: true, system: true };
const GROCERIES = { id: '00000000-0000-7000-8000-000000000002', name: 'Groceries', icon: 'groceries', color: 'chart3', isExpense: true, system: true };
const swiggy = {
  id: 't1',
  amountPaise: 48_600,
  direction: 'debit',
  type: 'expense',
  occurredAt: new Date().toISOString(),
  merchantName: 'Swiggy',
  category: FOOD,
  account: null,
};
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

const listQueries: URLSearchParams[] = [];
const patches: Array<{ path: string; body: unknown }> = [];

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === '/v1/categories') return json(200, { items: [FOOD, GROCERIES] });
  if (path === '/v1/accounts') return json(200, { items: [] });
  if (path === '/v1/transactions/recent-categories') return json(200, { ids: [] });
  if (path === '/v1/transactions' && req.method === 'GET') {
    listQueries.push(url.searchParams);
    const q = url.searchParams.get('q');
    if (q === 'nothing') return json(200, { items: [], nextCursor: null, dayTotals: [] });
    return json(200, { items: [swiggy], nextCursor: null, dayTotals: [{ date: today, debitPaise: 48_600, creditPaise: 0, netPaise: -48_600 }] });
  }
  if (path === '/v1/transactions/t1' && req.method === 'GET') {
    return json(200, { ...swiggy, note: null, categorySource: 'rule', userEdited: false, sources: [{ source: 'manual', receivedAt: swiggy.occurredAt }] });
  }
  if (path === '/v1/transactions/t1/category' && req.method === 'PATCH') {
    const body = await req.json();
    patches.push({ path, body });
    return json(200, {
      transaction: { ...swiggy, category: GROCERIES, note: null, categorySource: 'user', userEdited: false, sources: [] },
      updatedCount: 3,
    });
  }
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

// Required after the fetch mock so openapi-fetch picks it up.
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { TransactionsScreen, TransactionDetailScreen } = require('../src/features/transactions') as typeof import('../src/features/transactions');
const { useLedgerFilters } = require('../src/features/transactions/ledger-filters') as typeof import('../src/features/transactions/ledger-filters');
const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const providers = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
);

beforeEach(async () => {
  listQueries.length = 0;
  patches.length = 0;
  mockNavigate.mockClear();
  await act(async () => useLedgerFilters.getState().clear());
});

it('lists rows under a day header with the day total and opens Detail', async () => {
  await render(providers(<TransactionsScreen />));
  expect(await screen.findByText('TODAY')).toBeTruthy();
  expect(screen.getAllByText('−486.00').length).toBeGreaterThanOrEqual(2); // day total and the row
  await fireEvent.press(screen.getByRole('button', { name: /^Swiggy, paid/ }));
  expect(mockNavigate).toHaveBeenCalledWith('TransactionDetail', { id: 't1' });
});

it('sends quick filters and debounced search to the API, and offers to clear when nothing matches', async () => {
  await render(providers(<TransactionsScreen />));
  await screen.findByText('TODAY');
  await fireEvent.press(screen.getByRole('radio', { name: 'Debits' }));
  await waitFor(() => expect(listQueries.at(-1)?.get('direction')).toBe('debit'));

  await fireEvent.changeText(screen.getByLabelText('Search merchant or note'), 'nothing');
  expect(await screen.findByText('No matches', {}, { timeout: 2000 })).toBeTruthy();
  expect(listQueries.at(-1)?.get('q')).toBe('nothing');
  expect(listQueries.at(-1)?.get('limit')).toBe('50');

  await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
  expect(await screen.findByText('TODAY')).toBeTruthy();
  expect(useLedgerFilters.getState().filters).toEqual({});
});

it('changes category on Detail and applies it to the merchant by default', async () => {
  const route = { key: 'd', name: 'TransactionDetail' as const, params: { id: 't1' } };
  const nav = { goBack: jest.fn() } as never;
  await render(providers(<TransactionDetailScreen route={route} navigation={nav} />));
  await fireEvent.press(await screen.findByRole('button', { name: 'Change category' }));
  expect(screen.getByRole('switch', { name: 'Apply to all from Swiggy' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
  await waitFor(() => expect(patches).toHaveLength(1));
  expect(patches[0]?.body).toEqual({ categoryId: GROCERIES.id, applyToMerchant: true });
  expect(await screen.findByText('Also moved 3 other Swiggy transactions.')).toBeTruthy();
});

it('changes only this row when the switch is off', async () => {
  const route = { key: 'd', name: 'TransactionDetail' as const, params: { id: 't1' } };
  await render(providers(<TransactionDetailScreen route={route} navigation={{ goBack: jest.fn() } as never} />));
  await fireEvent.press(await screen.findByRole('button', { name: 'Change category' }));
  await fireEvent.press(screen.getByRole('switch', { name: 'Apply to all from Swiggy' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
  await waitFor(() => expect(patches).toHaveLength(1));
  expect(patches[0]?.body).toEqual({ categoryId: GROCERIES.id, applyToMerchant: false });
});
