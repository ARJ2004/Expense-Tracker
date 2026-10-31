import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BATCH_SIZE, READ_PAGE, sendable, syncInbox, toCaptured, type SyncDeps } from '../src/features/sms/sync';
import { syncSummary } from '../src/features/sms/labels';
import type { InboxMessage } from '../src/native/NativeSmsInbox';

const posts: unknown[] = [];
(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  if (new URL(req.url).pathname === '/v1/ingest/batch') {
    const body = (await req.json()) as { items: unknown[] };
    posts.push(body);
    return new Response(JSON.stringify({ created: body.items.length, merged: 0, skipped: 0, rejected: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'x' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
});

const mockReadInbox = jest.fn();
const mockIsDeclared = jest.fn(() => true);
jest.mock('../src/native/NativeSmsInbox', () => ({
  __esModule: true,
  default: { readInbox: (...args: unknown[]) => mockReadInbox(...args), isDeclared: () => mockIsDeclared() },
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
    expect(result).toEqual({ read: 251, found: 250, created: 250, merged: 0, skipped: 0, rejected: 0 });
    expect(f.watermark()).toBe(T0);
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

  it('does nothing on an empty inbox', async () => {
    const f = fake([]);
    expect(await syncInbox(f.deps)).toEqual({ read: 0, found: 0, created: 0, merged: 0, skipped: 0, rejected: 0 });
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

  it('when the API refuses a batch, sends its rows one by one and skips only the refused one', async () => {
    const messages = Array.from({ length: 3 }, (_, i) => HDFC(i, T0 - 10_000 + i));
    const bad = toCaptured(messages[1]!)!.messageKey;
    const f = fake(messages);
    f.deps.send = jest.fn(async (items) => {
      if (items.some((i) => i.messageKey === bad)) throw Object.assign(new Error('invalid'), { code: 'VALIDATION_FAILED' });
      return { created: items.length, merged: 0, skipped: 0, rejected: 0 };
    });
    const result = await syncInbox(f.deps);
    expect(result).toMatchObject({ created: 2, rejected: 1 });
    expect(f.deps.send).toHaveBeenCalledTimes(4); // the batch, then each row
    expect(f.watermark()).toBe(messages[2]!.receivedAt);
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

describe('SmsCaptureScreen', () => {
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

  function mount(permission: 'granted' | 'denied' | 'never_ask_again') {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(permission as never);
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
    const { SmsCaptureScreen, useSmsCapture } = require('../src/features/sms') as typeof import('../src/features/sms');
    const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');
    const goBack = jest.fn();
    const ui = (
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
          <ThemeProvider>
            <SmsCaptureScreen navigation={{ goBack } as never} route={{ key: 'sms', name: 'SmsCapture' } as never} />
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

  it('turns off and forgets progress', async () => {
    mockReadInbox.mockResolvedValue([]);
    const { ui, store } = mount('granted');
    store.getState().setEnabled(true);
    store.getState().setWatermark(T0);
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Check now' }));
    await waitFor(() => expect(screen.getByText('No new bank transactions in your SMS.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Turn off' }));
    expect(store.getState()).toMatchObject({ enabled: false, watermarkMs: null });
    expect(await screen.findByText('Read bank SMS to add spends for you')).toBeTruthy();
  });
});
