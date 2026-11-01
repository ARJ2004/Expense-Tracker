import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BATCH_SIZE, READ_PAGE, sendable, syncInbox, toCaptured, type SyncDeps } from '../src/features/sms/sync';
import { coverageLabel, progressLabel, syncSummary, transactionsLabel } from '../src/features/sms/labels';
import type { InboxMessage } from '../src/native/NativeSmsInbox';

const posts: unknown[] = [];
/** Last digits of the signed-in person's accounts, as GET /v1/accounts returns them. */
let accountDigits: string[] = [];
(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  if (new URL(req.url).pathname === '/v1/ingest/batch') {
    const body = (await req.json()) as { items: unknown[] };
    posts.push(body);
    return new Response(JSON.stringify({ created: body.items.length, merged: 0, skipped: 0, rejected: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (new URL(req.url).pathname === '/v1/accounts') {
    const items = accountDigits.map((d, i) => ({ id: `a${i}`, bankName: 'Some Bank', kind: 'savings', maskedNumber: d, nickname: null, createdAt: '2026-10-01T00:00:00Z' }));
    return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (new URL(req.url).pathname === '/v1/ingest/sources') {
    const items = [
      { kind: 'sms', transactions: 42, lastAt: '2026-10-18T07:42:10Z' },
      { kind: 'statement', transactions: 1240, lastAt: null },
      { kind: 'manual', transactions: 1, lastAt: null },
    ];
    return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'x' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
});

const mockReadInbox = jest.fn();
const mockCountInbox = jest.fn(async () => 0);
const mockSetLiveCapture = jest.fn();
const mockIsDeclared = jest.fn(() => true);
jest.mock('../src/native/NativeSmsInbox', () => ({
  __esModule: true,
  default: {
    readInbox: (...args: unknown[]) => mockReadInbox(...args),
    countInbox: (...args: unknown[]) => mockCountInbox(...(args as [])),
    setLiveCapture: (...args: unknown[]) => mockSetLiveCapture(...args),
    isDeclared: () => mockIsDeclared(),
  },
}));

const HDFC = (n: number, at: number): InboxMessage => ({
  sender: 'VM-HDFCBK',
  body: `Sent Rs.${100 + n}.00 From HDFC Bank A/C *1234 To SWIGGY On 18/10/26 Ref 4275123${String(n).padStart(5, '0')} Not You? Call 18002586161`,
  receivedAt: at,
});
const OTP: InboxMessage = { sender: 'VM-HDFCBK', body: 'OTP is 482913 for txn of Rs.486.00 at SWIGGY on HDFC Bank card ending 5678.', receivedAt: 0 };
const T0 = Date.parse('2026-10-18T07:42:10Z');

/** An inbox the sync reads page by page, and an API that records what it was sent. */
function fake(messages: InboxMessage[], opts: { failOnBatch?: number } = {}) {
  const sent: unknown[][] = [];
  let watermark: number | null = null;
  let batches = 0;
  const deps: SyncDeps = {
    readInbox: jest.fn(async (since: number, limit: number) => messages.filter((m) => m.receivedAt > since).slice(0, limit)),
    send: jest.fn(async (items) => {
      batches++;
      if (opts.failOnBatch === batches) throw new Error('offline');
      sent.push(items);
      return { created: items.length, merged: 0, skipped: 0, rejected: 0 };
    }),
    watermark: () => watermark,
    setWatermark: (ms) => (watermark = ms),
    now: () => T0 + 60_000,
  };
  return { deps, sent, watermark: () => watermark };
}

describe('toCaptured', () => {
  it('sends parsed fields and a fingerprint, never the body', () => {
    const item = toCaptured(HDFC(386, T0));
    expect(item).toEqual({
      source: 'sms',
      messageKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      amountPaise: 48_600,
      direction: 'debit',
      occurredAt: '2026-10-18T07:42:10.000Z',
      timePrecision: 'minute',
      bank: 'HDFC Bank',
      last4: '1234',
      counterparty: 'Swiggy',
      referenceNo: '427512300386',
      narration: 'UPI',
    });
    expect(JSON.stringify(item)).not.toContain('Not You');
  });

  it('drops OTPs and personal senders', () => {
    expect(toCaptured(OTP)).toBeNull();
    expect(toCaptured({ ...HDFC(1, T0), sender: '+919876543210' })).toBeNull();
  });
});

describe('syncInbox', () => {
  it('reads the last 90 days first, sends transactions in batches of 100, and moves the watermark', async () => {
    const messages = Array.from({ length: 250 }, (_, i) => HDFC(i, T0 - 10_000 + i));
    const f = fake([...messages, { ...OTP, receivedAt: T0 }]);
    const result = await syncInbox(f.deps);
    expect(f.deps.readInbox).toHaveBeenNthCalledWith(1, T0 + 60_000 - 90 * 86_400_000, READ_PAGE);
    expect(f.sent.map((b) => b.length)).toEqual([BATCH_SIZE, BATCH_SIZE, 50]);
    expect(result).toEqual({ read: 251, found: 250, unrecognised: 0, held: 0, created: 250, merged: 0, skipped: 0, rejected: 0 });
    expect(f.watermark()).toBe(T0);
  });

  it('counts bank messages no template reads, but not OTPs or offers', async () => {
    const unknown = { sender: 'VM-HDFCBK', body: 'Your HDFC Bank NetBanking profile was updated on 18-10-26.', receivedAt: T0 - 5 };
    const f = fake([HDFC(1, T0 - 10), { ...OTP, receivedAt: T0 - 7 }, unknown]);
    expect(await syncInbox(f.deps)).toMatchObject({ read: 3, found: 1, unrecognised: 1 });
    expect(coverageLabel({ read: 3, found: 1, unrecognised: 1 })).toBe('3 bank messages · 1 payment · 1 not recognised');
  });

  it('pages through a large inbox', async () => {
    const messages = Array.from({ length: READ_PAGE + 3 }, (_, i) => HDFC(i, T0 - 100_000 + i));
    const f = fake(messages);
    const result = await syncInbox(f.deps);
    expect(f.deps.readInbox).toHaveBeenCalledTimes(2);
    expect(result.found).toBe(READ_PAGE + 3);
  });

  it('resumes after the last accepted batch when sending fails', async () => {
    const messages = Array.from({ length: 150 }, (_, i) => HDFC(i, T0 - 10_000 + i));
    const f = fake(messages, { failOnBatch: 2 });
    await expect(syncInbox(f.deps)).rejects.toThrow('offline');
    expect(f.watermark()).toBe(messages[99]!.receivedAt);

    const retry = fake(messages);
    retry.deps.setWatermark(f.watermark()!);
    const result = await syncInbox(retry.deps);
    expect(result.found).toBe(50);
  });

  it('reports progress against the count of bank messages, never past 100%', async () => {
    const messages = Array.from({ length: READ_PAGE + 20 }, (_, i) => HDFC(i, T0 - 100_000 + i));
    const f = fake(messages);
    const onProgress = jest.fn();
    // The count was taken before 20 more arrived: the total grows instead of overflowing.
    await syncInbox({ ...f.deps, countInbox: async () => READ_PAGE, onProgress });
    expect(onProgress.mock.calls).toEqual([
      [0, READ_PAGE],
      [READ_PAGE, READ_PAGE],
      [READ_PAGE + 20, READ_PAGE + 20],
    ]);
    expect(progressLabel({ read: 120, total: 1340 })).toBe('Reading 120 of 1,340 bank messages');
  });

  it('does nothing on an empty inbox', async () => {
    const f = fake([]);
    expect(await syncInbox(f.deps)).toEqual({ read: 0, found: 0, unrecognised: 0, held: 0, created: 0, merged: 0, skipped: 0, rejected: 0 });
    expect(f.deps.send).not.toHaveBeenCalled();
  });

  it('drops a row dated far ahead on the phone and still moves past it', async () => {
    // A phone clock five days fast: the receive time and the date in the body both say 23 Oct.
    const future: InboxMessage = { ...HDFC(1, T0 + 5 * 86_400_000), body: HDFC(1, 0).body.replace('On 18/10/26', 'On 23/10/26') };
    const f = fake([HDFC(0, T0 - 1000), future]);
    const result = await syncInbox({ ...f.deps, now: () => T0 });
    expect(f.sent.flat()).toHaveLength(1);
    expect(result).toMatchObject({ found: 2, created: 1, rejected: 1 });
    expect(f.watermark()).toBe(future.receivedAt);
  });

  it('when an older API refuses a batch, splits it until the refused row is alone and skips only that row', async () => {
    const messages = Array.from({ length: 3 }, (_, i) => HDFC(i, T0 - 10_000 + i));
    const bad = toCaptured(messages[1]!)!.messageKey;
    const f = fake(messages);
    f.deps.send = jest.fn(async (items) => {
      if (items.some((i) => i.messageKey === bad)) throw Object.assign(new Error('invalid'), { code: 'VALIDATION_FAILED' });
      return { created: items.length, merged: 0, skipped: 0, rejected: 0 };
    });
    const result = await syncInbox(f.deps);
    expect(result).toMatchObject({ created: 2, rejected: 1 });
    expect(f.deps.send).toHaveBeenCalledTimes(5); // [0,1,2] → [0,1] → [0], [1]; then [2]
    expect(f.watermark()).toBe(messages[2]!.receivedAt);
  });

  it('isolates one bad row in a full batch in a handful of calls, not one per row', async () => {
    const messages = Array.from({ length: 100 }, (_, i) => HDFC(i, T0 - 10_000 + i));
    const bad = toCaptured(messages[57]!)!.messageKey;
    const f = fake(messages);
    f.deps.send = jest.fn(async (items) => {
      if (items.some((i) => i.messageKey === bad)) throw Object.assign(new Error('invalid'), { code: 'VALIDATION_FAILED' });
      return { created: items.length, merged: 0, skipped: 0, rejected: 0 };
    });
    expect(await syncInbox(f.deps)).toMatchObject({ created: 99, rejected: 1 });
    expect((f.deps.send as jest.Mock).mock.calls.length).toBeLessThanOrEqual(15);
  });

  it('stops at a rate limit and keeps the watermark where the last accepted batch left it', async () => {
    const messages = Array.from({ length: 150 }, (_, i) => HDFC(i, T0 - 10_000 + i));
    const f = fake(messages);
    let calls = 0;
    f.deps.send = jest.fn(async (items) => {
      if (++calls === 2) throw Object.assign(new Error('slow down'), { code: 'RATE_LIMITED' });
      return { created: items.length, merged: 0, skipped: 0, rejected: 0 };
    });
    await expect(syncInbox(f.deps)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(f.watermark()).toBe(messages[99]!.receivedAt);
  });
});

describe('sendable', () => {
  const base = toCaptured(HDFC(386, T0))!;

  it('leaves a valid row as it is', () => {
    expect(sendable(base, T0)).toEqual(base);
  });

  it('drops optional fields the API would refuse but keeps the payment', () => {
    const fixed = sendable({ ...base, referenceNo: 'AB-12', narration: 'upi', last4: '12', counterparty: '' }, T0)!;
    expect(fixed).toEqual(expect.objectContaining({ amountPaise: base.amountPaise, messageKey: base.messageKey }));
    expect(fixed).not.toHaveProperty('referenceNo');
    expect(fixed).not.toHaveProperty('narration');
    expect(fixed).not.toHaveProperty('last4');
    expect(fixed).not.toHaveProperty('counterparty');
  });

  it('refuses a row with no usable amount, bank or time', () => {
    expect(sendable({ ...base, amountPaise: 0 }, T0)).toBeNull();
    expect(sendable({ ...base, bank: '' }, T0)).toBeNull();
    expect(sendable({ ...base, occurredAt: new Date(T0 + 2 * 86_400_000).toISOString() }, T0)).toBeNull();
  });
});

describe('syncSummary', () => {
  it('counts transactions in Indian grouping', () => {
    expect(transactionsLabel(1)).toBe('1 transaction');
    expect(transactionsLabel(124000)).toBe('1,24,000 transactions');
  });

  it('says what happened in plain words', () => {
    expect(syncSummary({ found: 0, created: 0, merged: 0, skipped: 0, rejected: 0 })).toBe('No new bank transactions in your SMS.');
    expect(syncSummary({ found: 15, created: 12, merged: 2, skipped: 1, rejected: 0 })).toBe('Added 12 · 3 already in your ledger');
    expect(syncSummary({ found: 4, created: 3, merged: 0, skipped: 0, rejected: 1 })).toBe('Added 3 · 1 skipped (date looked wrong)');
  });
});

describe('PermissionExplainer', () => {
  const { PermissionExplainer } = require('../src/components') as typeof import('../src/components');
  const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');

  it.each(['light', 'dark'] as const)('shows the disclosure and only Allow asks for the permission (%s)', async (scheme) => {
    const onAllow = jest.fn();
    const onDecline = jest.fn();
    await render(
      <ThemeProvider scheme={scheme}>
        <PermissionExplainer icon="sms" title="Read bank SMS" points={['Reads bank alerts']} never="Never sends message text." allowLabel="Allow SMS access" onAllow={onAllow} onDecline={onDecline} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: 'Read bank SMS' })).toBeTruthy();
    expect(screen.getByText('Never sends message text.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onAllow).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow SMS access' }));
    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});

describe('DataSourcesScreen', () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const { Platform, PermissionsAndroid } = require('react-native') as typeof import('react-native');
  const os = Platform.OS;
  afterAll(() => {
    Platform.OS = os;
  });

  beforeEach(() => {
    posts.length = 0;
    mockReadInbox.mockReset();
    jest.restoreAllMocks();
    Platform.OS = 'android';
    (require('../src/features/sms') as typeof import('../src/features/sms')).useSmsCapture.getState().reset();
  });

  it('is unavailable in a build that leaves READ_SMS out (Play builds)', () => {
    const { smsCaptureAvailable } = require('../src/features/sms') as typeof import('../src/features/sms');
    expect(smsCaptureAvailable()).toBe(true);
    mockIsDeclared.mockReturnValueOnce(false);
    expect(smsCaptureAvailable()).toBe(false);
  });

  function mount(permission: 'granted' | 'denied' | 'never_ask_again', params: { explainSms?: boolean } = { explainSms: true }) {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue({ [PermissionsAndroid.PERMISSIONS.READ_SMS]: permission, [PermissionsAndroid.PERMISSIONS.RECEIVE_SMS]: permission } as never);
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
    const { DataSourcesScreen, useSmsCapture } = require('../src/features/sms') as typeof import('../src/features/sms');
    const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');
    const { NavigationContainer } = require('@react-navigation/native') as typeof import('@react-navigation/native');
    const goBack = jest.fn();
    const ui = (
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
          <ThemeProvider>
            <NavigationContainer>
              <DataSourcesScreen navigation={{ goBack } as never} route={{ key: 'sources', name: 'DataSources', params } as never} />
            </NavigationContainer>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
    return { ui, request, goBack, store: useSmsCapture };
  }

  it('asks Android only after Allow, then reads and sends the parsed SMS', async () => {
    mockReadInbox.mockResolvedValueOnce([HDFC(386, T0), OTP]).mockResolvedValue([]);
    const { ui, request, store } = mount('granted');
    await render(ui);
    expect(screen.getByText('Read bank SMS to add spends for you')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Allow SMS access' }));
    expect(await screen.findByText('Added 1')).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.getState().enabled).toBe(true);
    expect(posts).toHaveLength(1);
    expect(JSON.stringify(posts[0])).not.toMatch(/Not You|OTP/);
    // Only business senders are read (no people, no promotions), from the one pattern in @et/parsers.
    const { transactionSenderPatterns } = require('@et/parsers') as typeof import('@et/parsers');
    expect(mockReadInbox).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), transactionSenderPatterns());
    // Debug builds also say how many bank messages were read.
    expect(screen.getByText('2 bank messages · 1 payment · 0 not recognised')).toBeTruthy();
  });

  it('stays off when the user says no, and points to Android settings after "don\'t ask again"', async () => {
    const denied = mount('denied');
    await render(denied.ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow SMS access' }));
    expect(await screen.findByText('SMS stays off. You can allow it any time.')).toBeTruthy();
    expect(denied.store.getState().enabled).toBe(false);
    expect(mockReadInbox).not.toHaveBeenCalled();
  });

  it('offers Android settings when Android will not ask again', async () => {
    const blocked = mount('never_ask_again');
    await render(blocked.ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow SMS access' }));
    expect(await screen.findByRole('button', { name: 'Open Android settings' })).toBeTruthy();
  });

  it('turns off, forgets progress and tells the SMS receiver', async () => {
    mockReadInbox.mockResolvedValue([]);
    const { ui, store } = mount('granted', {});
    store.getState().setEnabled(true);
    store.getState().setWatermark(T0);
    expect(mockSetLiveCapture).toHaveBeenLastCalledWith(true, expect.any(Array));
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Check now' }));
    await waitFor(() => expect(screen.getByText('No new bank transactions in your SMS.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Turn off' }));
    expect(store.getState()).toMatchObject({ enabled: false, watermarkMs: null });
    expect(mockSetLiveCapture).toHaveBeenLastCalledWith(false, expect.any(Array));
    expect(await screen.findByRole('button', { name: 'Turn on' })).toBeTruthy();
  });

  it('lists what each source added, and opens the disclosure from Turn on', async () => {
    const { ui } = mount('granted', {});
    await render(ui);
    expect(await screen.findByText('1,240 transactions')).toBeTruthy();
    expect(screen.getByText('1 transaction')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on' }));
    expect(screen.getByText('Read bank SMS to add spends for you')).toBeTruthy();
  });

  it('shows how far a long first sync has got', async () => {
    const { ui, store } = mount('granted', {});
    store.getState().setEnabled(true);
    store.getState().setProgress({ read: 120, total: 340 });
    await render(ui);
    expect(screen.getByText('Reading 120 of 340 bank messages')).toBeTruthy();
    expect(await screen.findByText('42 transactions')).toBeTruthy();
  });
});

describe('onBankSms (the headless task)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReadInbox.mockReset();
    (require('../src/features/sms') as typeof import('../src/features/sms')).useSmsCapture.getState().reset();
  });
  afterEach(() => jest.useRealTimers());

  const { onBankSms } = require('../src/features/sms/task') as typeof import('../src/features/sms/task');
  const { secureStore } = require('../src/lib') as typeof import('../src/lib');

  it('does nothing while capture is off', async () => {
    const run = onBankSms();
    await jest.runAllTimersAsync();
    await run;
    expect(mockReadInbox).not.toHaveBeenCalled();
  });

  it('retries until the SMS app has written the message to the inbox', async () => {
    jest.spyOn(secureStore, 'getRefreshToken').mockResolvedValue('refresh');
    const { useSmsCapture } = require('../src/features/sms') as typeof import('../src/features/sms');
    useSmsCapture.getState().setEnabled(true);
    useSmsCapture.getState().setWatermark(T0 - 1);
    // First read: not in the inbox yet. Second read: there. (A catch-up read for banks added
    // since finds nothing.)
    const hdfcReads = [[], [HDFC(500, T0)]];
    mockReadInbox.mockImplementation(async (_since: number, _limit: number, senders: string[]) =>
      senders.some((p) => new RegExp(p, 'i').test('VM-HDFCBK')) ? (hdfcReads.shift() ?? []) : [],
    );
    const run = onBankSms();
    await jest.runAllTimersAsync();
    await run;
    expect(useSmsCapture.getState().watermarkMs).toBe(T0);
    expect(posts.at(-1)).toEqual({ items: [expect.objectContaining({ amountPaise: 60_000 })] });
  });
});

describe('SMS capture belongs to one user', () => {
  const { useSmsCapture } = require('../src/features/sms') as typeof import('../src/features/sms');
  const { runSmsSync } = require('../src/features/sms/run') as typeof import('../src/features/sms/run');
  const { useSession } = require('../src/features/auth') as typeof import('../src/features/auth');
  const user = (id: string) => ({ id, email: `${id}@example.com`, name: id, monthlyIncomePaise: null, incomeFrequency: null, onboarded: true, currency: 'INR', timezone: 'Asia/Kolkata' });

  beforeEach(() => {
    posts.length = 0;
    mockReadInbox.mockReset();
    useSession.setState({ user: null, status: 'signedOut' });
    useSmsCapture.getState().reset();
  });

  it('turns capture off the moment another user signs in, so nothing of the last user is read', async () => {
    useSession.setState({ user: user('asha') as never, status: 'signedIn' });
    useSmsCapture.getState().setEnabled(true);
    useSession.setState({ user: null, status: 'signedOut' });

    // Ravi signs in on the same phone: claimed synchronously, before any screen or sync runs.
    useSession.setState({ user: user('ravi') as never, status: 'signedIn' });
    expect(useSmsCapture.getState().enabled).toBe(false);
    mockReadInbox.mockResolvedValue([HDFC(1, T0)]);
    expect(await runSmsSync()).toMatchObject({ read: 0, created: 0 });
    expect(mockReadInbox).not.toHaveBeenCalled();
    expect(posts).toHaveLength(0);
  });

  it('keeps capture on when the same user signs in again', () => {
    useSession.setState({ user: user('asha') as never, status: 'signedIn' });
    useSmsCapture.getState().setEnabled(true);
    useSession.setState({ user: null, status: 'signedOut' });
    useSession.setState({ user: user('asha') as never, status: 'signedIn' });
    expect(useSmsCapture.getState().enabled).toBe(true);
  });

  it('stops a running sync at Turn off and leaves the watermark cleared', async () => {
    useSession.setState({ user: user('asha') as never, status: 'signedIn' });
    useSmsCapture.getState().setEnabled(true);
    const page = Array.from({ length: READ_PAGE }, (_, i) => HDFC(i, T0 - 100_000 + i));
    // Turn off lands while the first page is being read.
    mockReadInbox.mockImplementationOnce(async () => {
      useSmsCapture.getState().reset();
      return page;
    });
    await runSmsSync();
    expect(posts).toHaveLength(0);
    expect(useSmsCapture.getState()).toMatchObject({ enabled: false, watermarkMs: null, lastSyncMs: null });
  });
});

describe('an update that reads more senders', () => {
  const { useSmsCapture } = require('../src/features/sms') as typeof import('../src/features/sms');
  const { runSmsSync } = require('../src/features/sms/run') as typeof import('../src/features/sms/run');
  const SVC: InboxMessage = {
    sender: 'VH-SVCBNK',
    body: 'SVC Bank A/c *1234 DEBITED for Rs.11.00 Clr Bal Rs.1,89,764.50. CR UPI/DR/427512345701/KALLAHALL/. Not You? Call 18003132120',
    receivedAt: T0 - 86_400_000,
  };
  const since = () => mockReadInbox.mock.calls.map(([ms]) => ms as number);

  beforeEach(() => {
    posts.length = 0;
    mockReadInbox.mockReset();
    useSmsCapture.getState().reset();
    useSmsCapture.getState().setEnabled(true);
    mockReadInbox.mockImplementation(async (ms: number) => inbox.filter((m) => m.receivedAt > ms));
    inbox = [SVC];
  });
  let inbox: InboxMessage[] = [];

  it('reads the last 90 days once when the watermark came from the template-only reader', async () => {
    // HDFC was read before, with older fingerprints: reading it again could add it twice.
    inbox = [HDFC(7, T0 - 2 * 86_400_000), SVC];
    // Synced by a version that read only HDFC, SBI, ICICI and Axis: the watermark is past the SVC message.
    useSmsCapture.getState().setWatermark(T0);
    await runSmsSync();
    expect(since()[0]).toBeLessThan(Date.now() - 89 * 86_400_000);
    expect(posts).toEqual([{ items: [expect.objectContaining({ bank: 'SVC Bank', amountPaise: 1100, direction: 'debit' })] }]);
    expect(useSmsCapture.getState().watermarkMs).toBe(T0);

    mockReadInbox.mockClear();
    await runSmsSync();
    expect(since()).toEqual([T0]);
    expect(posts).toHaveLength(1);
  });

  it('needs no catch-up after a first sync', async () => {
    await runSmsSync();
    expect(since()).toHaveLength(1);
    expect(posts).toHaveLength(1);
    mockReadInbox.mockClear();
    await runSmsSync();
    expect(since()).toEqual([SVC.receivedAt]);
  });
});

describe('a sender Altus does not know', () => {
  const { useSmsCapture } = require('../src/features/sms') as typeof import('../src/features/sms');
  const { approveSender, runSmsSync } = require('../src/features/sms/run') as typeof import('../src/features/sms/run');
  const { markCaughtUp } = require('../src/features/sms/store') as typeof import('../src/features/sms/store');
  const { Platform } = require('react-native') as typeof import('react-native');
  const NEW = (n: number, last4 = '1234'): InboxMessage => ({
    sender: 'VM-NEWBNK-S',
    body: `Your a/c XX${last4} is debited by Rs.${300 + n}.00 on 01-11-26 towards UPI/4275123457${String(n).padStart(2, '0')}/TEA STALL. -New Co-op Bank`,
    receivedAt: T0 + n,
  });
  let inbox: InboxMessage[] = [];

  beforeEach(() => {
    posts.length = 0;
    accountDigits = [];
    inbox = [];
    mockReadInbox.mockReset();
    mockReadInbox.mockImplementation(async (ms: number) => inbox.filter((m) => m.receivedAt > ms));
    useSmsCapture.getState().reset();
    useSmsCapture.getState().setEnabled(true);
    useSmsCapture.getState().setWatermark(T0);
    markCaughtUp();
  });
  afterAll(() => {
    accountDigits = [];
  });

  it('holds its transactions on the phone until the person says it is their bank', async () => {
    inbox = [NEW(1), NEW(2)];
    expect(await runSmsSync()).toMatchObject({ found: 2, held: 2, created: 0 });
    expect(posts).toHaveLength(0);
    expect(useSmsCapture.getState().held.NEWBNK).toHaveLength(2);
    // Read again (Check now): still two, not four.
    useSmsCapture.getState().setWatermark(T0);
    await runSmsSync();
    expect(useSmsCapture.getState().held.NEWBNK).toHaveLength(2);

    await approveSender('NEWBNK');
    expect(posts).toEqual([{ items: [expect.objectContaining({ amountPaise: 30_100 }), expect.objectContaining({ amountPaise: 30_200 })] }]);
    expect(useSmsCapture.getState()).toMatchObject({ held: {}, trusted: ['NEWBNK'] });

    // Trusted from now on: the next one goes straight in.
    inbox = [NEW(3)];
    useSmsCapture.getState().setWatermark(T0 + 2);
    expect(await runSmsSync()).toMatchObject({ held: 0, created: 1 });
  });

  it('keeps them if sending fails, so the person can try again', async () => {
    inbox = [NEW(1)];
    await runSmsSync();
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementationOnce(async () => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }));
    await expect(approveSender('NEWBNK')).rejects.toBeTruthy();
    expect(useSmsCapture.getState().held.NEWBNK).toHaveLength(1);
    expect(useSmsCapture.getState().trusted).toEqual([]);
  });

  it('drops them, and everything after, when the person says it is not their bank', async () => {
    inbox = [NEW(1)];
    await runSmsSync();
    useSmsCapture.getState().block('NEWBNK');
    expect(useSmsCapture.getState().held).toEqual({});
    inbox = [NEW(1), NEW(2)];
    expect(await runSmsSync()).toMatchObject({ held: 0, created: 0 });
    expect(posts).toHaveLength(0);
    expect(useSmsCapture.getState().held).toEqual({});
  });

  it('trusts it straight away when it names one of the person’s accounts', async () => {
    accountDigits = ['1234'];
    inbox = [NEW(1)];
    expect(await runSmsSync()).toMatchObject({ held: 0, created: 1 });
    expect(useSmsCapture.getState().trusted).toEqual(['NEWBNK']);
    // An account they don't have is still held.
    useSmsCapture.getState().reset();
    useSmsCapture.getState().setEnabled(true);
    useSmsCapture.getState().setWatermark(T0);
    markCaughtUp();
    inbox = [NEW(2, '9999')];
    expect(await runSmsSync()).toMatchObject({ held: 1, created: 0 });
  });

  it('shows on Data sources, and "Yes, my bank" adds the transactions', async () => {
    inbox = [NEW(1)];
    await runSmsSync();
    posts.length = 0;
    const os = Platform.OS;
    Platform.OS = 'android';
    const { DataSourcesScreen } = require('../src/features/sms') as typeof import('../src/features/sms');
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
    const { NavigationContainer } = require('@react-navigation/native') as typeof import('@react-navigation/native');
    const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <QueryClientProvider client={client}>
          <ThemeProvider>
            <NavigationContainer>
              <DataSourcesScreen navigation={{ goBack: jest.fn() } as never} route={{ key: 'sources', name: 'DataSources', params: undefined } as never} />
            </NavigationContainer>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByText('NEW SENDERS')).toBeTruthy();
    expect(screen.getByText('NEWBNK')).toBeTruthy();
    expect(screen.getByText('1 transaction · latest ₹301.00 debited from ••1234. Is this your bank?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, my bank' }));
    await waitFor(() => expect(screen.queryByText('NEWBNK')).toBeNull());
    expect(posts).toHaveLength(1);
    Platform.OS = os;
  });
});

describe('ledger cache refresh', () => {
  const { invalidateLedger, ledgerRoots } = require('../src/lib') as typeof import('../src/lib');
  const { transactionKeys } = require('../src/features/transactions') as typeof import('../src/features/transactions');
  const { QueryClient } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');

  it('refreshes lists, open details, Home and source counts, and nothing else', async () => {
    const qc = new QueryClient();
    const keys = [transactionKeys.list({} as never), transactionKeys.detail('t1'), ['dashboard', 'summary', '2026-11'], ['ingest', 'sources'], ['categories'], ['imports'], ['health']];
    keys.forEach((k) => qc.setQueryData(k, 1));
    await invalidateLedger(qc);
    const stale = keys.filter((k) => qc.getQueryState(k)?.isInvalidated).map((k) => k[0]);
    expect(stale).toEqual(['transactions', 'transactions', 'dashboard', 'ingest']);
    expect(Object.keys(ledgerRoots)).toEqual(['transactions', 'dashboard', 'sources']);
  });
});
