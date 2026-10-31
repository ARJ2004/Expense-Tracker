import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { pick } from '@react-native-documents/picker';

const SHOPPING = { id: '00000000-0000-7000-8000-000000000004', name: 'Shopping', icon: 'shopping', color: 'warning', isExpense: true, system: true };
const BILLS = { id: '00000000-0000-7000-8000-000000000005', name: 'Bills & Utilities', icon: 'bills', color: 'chart4', isExpense: true, system: true };
const OTHER = { id: '00000000-0000-7000-8000-000000000013', name: 'Other', icon: 'other', color: 'muted', isExpense: true, system: true };
const HDFC = { id: 'a1', bankName: 'HDFC Bank', maskedNumber: '1234', kind: 'savings', nickname: null };

const base = {
  id: 'i1',
  fileName: 'HDFC_Oct2026.csv',
  status: 'review',
  bankDetected: 'HDFC Bank',
  account: { id: 'a1', bankName: 'HDFC Bank', maskedNumber: '1234' },
  periodFrom: '2026-10-01',
  periodTo: '2026-10-31',
  rowCount: 166,
  newCount: 142,
  duplicateCount: 18,
  flaggedCount: 0,
  needsCategoryCount: 2,
  selectedCount: 142,
  importedCount: 0,
  mergedCount: 0,
  error: null,
  createdAt: '2026-11-03T05:00:00.000Z',
  confirmedAt: null,
};
const row = (rowNo: number, merchantName: string, amountPaise: number, extra: object = {}) => ({
  rowNo,
  occurredOn: '2026-10-12',
  amountPaise,
  direction: 'debit',
  narration: merchantName,
  merchantName,
  referenceNo: null,
  balancePaise: null,
  category: OTHER,
  categorySource: 'default',
  status: 'new',
  duplicateOf: null,
  balanceMismatch: false,
  action: 'import',
  edited: false,
  ...extra,
});

let detail: Record<string, unknown> = base;
let rows = [row(1, 'AMZN MKTP IN', 239_900), row(2, 'BESCOM BILLPAY', 184_000), row(3, 'Swiggy', 48_600, { status: 'duplicate', duplicateOf: 't9', action: 'skip' })];
const calls: Array<{ method: string; path: string; body?: unknown }> = [];

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = new URL(req.url).pathname;
  const body = req.method === 'PATCH' ? await req.json() : undefined;
  calls.push({ method: req.method, path, body });
  if (path === '/v1/categories') return json(200, { items: [SHOPPING, BILLS, OTHER] });
  if (path === '/v1/accounts') return json(200, { items: [HDFC] });
  if (path === '/v1/transactions/recent-categories') return json(200, { ids: [] });
  if (path === '/v1/imports' && req.method === 'GET') return json(200, { items: [base, { ...base, id: 'i2', fileName: 'ICICI_Sep2026.xlsx', status: 'imported', importedCount: 96, duplicateCount: 0, confirmedAt: '2026-10-02T05:00:00.000Z' }] });
  if (path === '/v1/imports' && req.method === 'POST') return json(202, { import: { ...base, id: 'i3', status: 'parsing' }, alreadyImportedAt: '2026-11-03T05:00:00.000Z' });
  if (path === '/v1/imports/i1' && req.method === 'GET') return json(200, detail);
  if (path === '/v1/imports/i1' && req.method === 'PATCH') {
    detail = { ...detail, account: { id: 'a1', bankName: 'HDFC Bank', maskedNumber: '1234' } };
    return json(200, detail);
  }
  if (path === '/v1/imports/i1/rows') return json(200, { items: rows });
  if (path.startsWith('/v1/imports/i1/rows/') && req.method === 'PATCH') {
    const n = Number(path.split('/').pop());
    const b = body as { categoryId?: string; action?: string };
    rows = rows.map((r) =>
      r.rowNo === n ? { ...r, ...(b.categoryId ? { category: [SHOPPING, BILLS, OTHER].find((c) => c.id === b.categoryId)!, categorySource: 'user' } : {}), ...(b.action ? { action: b.action } : {}) } : r,
    );
    return json(200, rows.find((r) => r.rowNo === n));
  }
  if (path === '/v1/imports/i1/confirm') return json(200, { ...detail, status: 'imported', importedCount: 142, mergedCount: 18 });
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { ImportsScreen, ImportReviewScreen } = require('../src/features/imports') as typeof import('../src/features/imports');
const labels = require('../src/features/imports/labels') as typeof import('../src/features/imports/labels');
const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const providers = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
);
const review = () => {
  const route = { key: 'r', name: 'ImportReview' as const, params: { id: 'i1' } };
  return providers(<ImportReviewScreen route={route} navigation={{ goBack: jest.fn(), navigate: mockNavigate } as never} />);
};

beforeEach(() => {
  calls.length = 0;
  mockNavigate.mockClear();
  detail = base;
  rows = [row(1, 'AMZN MKTP IN', 239_900), row(2, 'BESCOM BILLPAY', 184_000), row(3, 'Swiggy', 48_600, { status: 'duplicate', duplicateOf: 't9', action: 'skip' })];
});

describe('labels', () => {
  it('formats the period and status lines like the mockups', () => {
    expect(labels.periodLabel('2026-10-01', '2026-10-31')).toBe('1–31 Oct 2026');
    expect(labels.periodLabel('2026-09-28', '2026-10-03')).toBe('28 Sep – 3 Oct 2026');
    expect(labels.reviewSubtitle(base as never)).toBe('HDFC ••1234 · 1–31 Oct 2026 · 166 rows');
    expect(labels.importSubtitle({ ...base, status: 'imported', importedCount: 142, confirmedAt: '2026-11-03T05:00:00.000Z' } as never)).toBe('3 Nov · 142 added, 18 duplicates');
    expect(labels.importTag(base as never)).toEqual({ label: '142 to review', tone: 'warning' });
    expect(labels.failureLabel('IMPORT_NO_ROWS')).toBe('No transactions in this file');
  });
});

it('lists recent imports and opens Review after a file is uploaded', async () => {
  (pick as jest.Mock).mockResolvedValueOnce([{ uri: 'content://x/1', name: 'HDFC.csv', type: 'text/csv' }]);
  await render(providers(<ImportsScreen />));
  expect(await screen.findByText('ICICI_Sep2026.xlsx')).toBeTruthy();
  expect(screen.getByText('Done')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose file' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('ImportReview', { id: 'i3', alreadyImportedAt: '2026-11-03T05:00:00.000Z' }));
  expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/imports')).toBe(true);
});

it('shows the API reason when the upload is refused', async () => {
  (pick as jest.Mock).mockResolvedValueOnce([{ uri: 'content://x/2', name: 'statement.pdf', type: 'application/pdf' }]);
  const fetchMock = globalThis.fetch as jest.Mock;
  await render(providers(<ImportsScreen />));
  await screen.findByText('ICICI_Sep2026.xlsx');
  // The next request is the upload.
  fetchMock.mockImplementationOnce(async () =>
    new Response(JSON.stringify({ error: { code: 'IMPORT_PDF_NOT_YET', message: 'x' } }), { status: 415, headers: { 'Content-Type': 'application/json' } }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose file' }));
  expect(await screen.findByText(/PDF support is coming next\. Export/)).toBeTruthy();
});

it('shows the summary, lets the user pick categories, and adds the rows', async () => {
  await render(review());
  expect(await screen.findByText('HDFC ••1234 · 1–31 Oct 2026 · 166 rows')).toBeTruthy();
  expect(screen.getByLabelText('142 new')).toBeTruthy();
  expect(screen.getByLabelText('18 duplicates skipped')).toBeTruthy();
  expect(await screen.findByText('AMZN MKTP IN')).toBeTruthy();
  expect(screen.getByText('0 of 2')).toBeTruthy();
  expect(screen.queryByText('Swiggy')).toBeNull();

  await fireEvent.press(screen.getAllByRole('radio', { name: 'Shopping' })[0]!);
  await waitFor(() => expect(calls.find((c) => c.path === '/v1/imports/i1/rows/1')?.body).toEqual({ categoryId: SHOPPING.id }));
  expect(await screen.findByText('1 of 2')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Add 142 transactions' }));
  await waitFor(() => expect(calls.some((c) => c.path === '/v1/imports/i1/confirm')).toBe(true));
  expect(await screen.findByLabelText('142 added')).toBeTruthy();
  expect(screen.getByLabelText('18 matched in ledger')).toBeTruthy();
});

it('asks for the account when the file did not name it', async () => {
  detail = { ...base, account: null };
  await render(review());
  expect(await screen.findByText('Which account is this?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add 142 transactions' })).toBeDisabled();
  await fireEvent.press(await screen.findByRole('radio', { name: 'HDFC Bank ••1234' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.path === '/v1/imports/i1')?.body).toEqual({ accountId: 'a1' }));
  await waitFor(() => expect(screen.queryByText('Which account is this?')).toBeNull());
});

it('lists every row in "Review all rows" with duplicates switched off', async () => {
  await render(review());
  await fireEvent.press(await screen.findByRole('button', { name: 'Review all rows' }));
  const swiggy = await screen.findByRole('switch', { name: 'Swiggy' });
  expect(swiggy).not.toBeChecked();
  expect(screen.getByText('Already in ledger')).toBeTruthy();
  await fireEvent.press(swiggy);
  await waitFor(() => expect(calls.find((c) => c.path === '/v1/imports/i1/rows/3')?.body).toEqual({ action: 'import' }));
});
