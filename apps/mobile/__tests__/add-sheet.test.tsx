import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const FOOD = { id: '00000000-0000-7000-8000-000000000001', name: 'Food & Dining', icon: 'food', color: 'chart2', isExpense: true, system: true };
const posts: Array<Record<string, unknown>> = [];
let failNext = false;

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = new URL(req.url).pathname;
  if (path === '/v1/categories') return json(200, { items: [FOOD] });
  if (path === '/v1/accounts') return json(200, { items: [] });
  if (path === '/v1/transactions/recent-categories') return json(200, { ids: [] });
  if (path === '/v1/transactions' && req.method === 'POST') {
    const body = await req.json();
    posts.push(body);
    if (failNext) {
      failNext = false;
      throw new TypeError('Network request failed');
    }
    return json(201, { id: 't1', ...body, type: 'expense', merchantName: body.merchantName ?? null, note: null, categorySource: 'user', userEdited: false, category: FOOD, account: null, sources: [] });
  }
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

// Required after the fetch mock so openapi-fetch picks it up.
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { AddTransactionSheet, useAddSheet } = require('../src/features/transactions') as typeof import('../src/features/transactions');
const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderSheet(onSaved = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}>
        <ThemeProvider>
          <AddTransactionSheet onSaved={onSaved} />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return onSaved;
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  posts.length = 0;
});

it('saves a ₹486.50 debit in paise with the picked category', async () => {
  await act(async () => useAddSheet.getState().openNew());
  const onSaved = await renderSheet();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  for (const k of ['4', '8', '6', 'Decimal point', '5']) await press(k);
  await fireEvent.press(screen.getByRole('radio', { name: 'Food & Dining' }));
  await fireEvent.changeText(screen.getByLabelText('Paid to'), 'Swiggy');
  await press('Save');
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(posts[0]).toMatchObject({ amountPaise: 48_650, direction: 'debit', categoryId: FOOD.id, merchantName: 'Swiggy' });
  expect(posts[0]?.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(useAddSheet.getState().visible).toBe(false);
});

it('retries a failed save with the same clientRequestId', async () => {
  await act(async () => useAddSheet.getState().openNew());
  await renderSheet();
  await press('7');
  failNext = true;
  await press('Save');
  await screen.findByText("Can't reach Altus. Check your connection.");
  await press('Save');
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[1]?.clientRequestId).toBe(posts[0]?.clientRequestId);
});

it('starts a new request id each time the sheet opens', async () => {
  await act(async () => useAddSheet.getState().openNew());
  const first = useAddSheet.getState().clientRequestId;
  await act(async () => useAddSheet.getState().openNew());
  expect(useAddSheet.getState().clientRequestId).not.toBe(first);
});
