import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { istDateKey } from '@et/domain';

const TODAY = istDateKey(new Date());
const members = [
  { id: 'you', name: 'You', isSelf: true },
  { id: 'ravi', name: 'Ravi', isSelf: false },
  { id: 'priya', name: 'Priya', isSelf: false },
  { id: 'arjun', name: 'Arjun', isSelf: false },
];

/** Goa trip as the API returns it: Priya paid ₹3,600 for four, You paid ₹1,200 for You and Ravi. */
function goa(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    name: 'Goa trip',
    emoji: '🏖️',
    archived: false,
    members,
    balances: [
      { memberId: 'you', netPaise: -300_00 },
      { memberId: 'ravi', netPaise: -1500_00 },
      { memberId: 'priya', netPaise: 2700_00 },
      { memberId: 'arjun', netPaise: -900_00 },
    ],
    transfers: [
      { fromId: 'ravi', toId: 'priya', amountPaise: 1500_00 },
      { fromId: 'arjun', toId: 'priya', amountPaise: 900_00 },
      { fromId: 'you', toId: 'priya', amountPaise: 300_00 },
    ],
    settled: false,
    totalSpentPaise: 4800_00,
    mySharePaise: 1500_00,
    myNetPaise: -300_00,
    ...over,
  };
}
const dinner = {
  kind: 'expense',
  id: 'e1',
  day: TODAY,
  amountPaise: 3600_00,
  description: "Dinner at Fisherman's Wharf",
  paidById: 'priya',
  splitMode: 'equal',
  shares: members.map((m) => ({ memberId: m.id, sharePaise: 900_00 })),
};

let detail = goa();
let list: unknown[] = [];
const requests: Array<{ method: string; path: string; body?: unknown }> = [];

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = new URL(req.url).pathname;
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json();
  requests.push({ method: req.method, path, body });
  if (path === '/v1/groups' && req.method === 'GET') return json(200, { items: list });
  if (path === '/v1/groups' && req.method === 'POST') return json(201, goa({ id: 'g2' }));
  if (path === '/v1/groups/g1' && req.method === 'GET') return json(200, detail);
  if (path === '/v1/groups/g1/activity') return json(200, { items: [dinner], nextCursor: null });
  if (path === '/v1/groups/g1/expenses') return json(201, { ...dinner, id: 'e2', ...(body as object) });
  if (path === '/v1/groups/g1/payments') return json(201, { kind: 'payment', id: 'p1', ...(body as object) });
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { GroupsScreen, GroupDetailScreen, GroupExpenseFormScreen, GroupFormScreen } = require('../src/features/groups') as typeof import('../src/features/groups');
const { activityLine, balanceWords, dayLabel, memberTone, myNetLabel } = require('../src/features/groups/labels') as typeof import('../src/features/groups/labels');
const { sharePaise } = require('../src/features/groups/components/SplitEditor') as typeof import('../src/features/groups/components/SplitEditor');
const { typedRupees } = require('../src/features/groups/components/SettleUpSheet') as typeof import('../src/features/groups/components/SettleUpSheet');
const { ThemeProvider } = require('../src/theme') as typeof import('../src/theme');

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>
        <ThemeProvider>{ui}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() });

beforeEach(() => {
  requests.length = 0;
  detail = goa();
  list = [];
});

describe('labels', () => {
  it('words balances and the list line', () => {
    expect(balanceWords(500)).toEqual({ words: 'gets back', tone: 'income' });
    expect(balanceWords(-500)).toEqual({ words: 'owes', tone: 'spend' });
    expect(myNetLabel(505_000).text).toBe('you are owed ₹5,050');
    expect(myNetLabel(-30_000).text).toBe('you owe ₹300');
    expect(myNetLabel(0).text).toBe('settled up');
  });

  it('tells each expense and payment from my side', () => {
    expect(activityLine(dinner as never, members)).toMatchObject({ subtitle: 'Priya paid ₹3,600', caption: 'you owe', paise: 900_00, tone: 'spend' });
    const mine = { ...dinner, paidById: 'you' };
    expect(activityLine(mine as never, members)).toMatchObject({ subtitle: 'You paid ₹3,600', caption: 'you lent', paise: 2700_00 });
    const paidMe = { kind: 'payment', id: 'p', day: TODAY, amountPaise: 2000_00, fromId: 'arjun', toId: 'you' };
    expect(activityLine(paidMe as never, members)).toMatchObject({ title: 'Arjun paid You', caption: 'you received', tone: 'income' });
  });

  it('names days and gives everyone but You a cycling tone', () => {
    expect(dayLabel(TODAY, TODAY)).toMatch(/^Today · \d+ \w{3}$/);
    expect(memberTone(members, 'you')).toBe('navy');
    expect(['ravi', 'priya', 'arjun'].map((id) => memberTone(members, id))).toEqual(['soft', 'amber', 'teal']);
  });

  it('turns typed rupees into paise and back without floats', () => {
    expect(sharePaise('480')).toBe(48_000);
    expect(sharePaise('33.5')).toBe(3350);
    expect(sharePaise('')).toBe(0);
    expect(typedRupees(3334)).toBe('33.34');
    expect(typedRupees(255_000)).toBe('2550');
  });
});

describe('GroupsScreen', () => {
  it('invites to create a group when there are none', async () => {
    const n = nav();
    await render(wrap(<GroupsScreen navigation={n as never} route={{ key: 'k', name: 'Groups' } as never} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Create group' }));
    expect(n.navigate).toHaveBeenCalledWith('GroupForm');
  });

  it('lists groups with my balance in each', async () => {
    list = [{ id: 'g1', name: 'Goa trip', emoji: '🏖️', memberCount: 4, myNetPaise: 505_000, archived: false }];
    const n = nav();
    await render(wrap(<GroupsScreen navigation={n as never} route={{ key: 'k', name: 'Groups' } as never} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Goa trip, 4 members, you are owed ₹5,050' }));
    expect(n.navigate).toHaveBeenCalledWith('GroupDetail', { id: 'g1' });
  });
});

describe('GroupFormScreen', () => {
  it('creates a group with the names added, You first and always included', async () => {
    const n = nav();
    await render(wrap(<GroupFormScreen navigation={n as never} route={{ key: 'k', name: 'GroupForm' } as never} />));
    expect(screen.getByText('Always included')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Group name'), 'Goa trip');
    for (const name of ['Ravi', 'Priya']) {
      await fireEvent.changeText(screen.getByLabelText('Add a member'), name);
      await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Create group' }));
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('GroupDetail', { id: 'g2' }));
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ name: 'Goa trip', members: ['Ravi', 'Priya'], emoji: '🏖️' });
  });
});

describe('GroupDetailScreen', () => {
  const show = () => render(wrap(<GroupDetailScreen navigation={nav() as never} route={{ key: 'k', name: 'GroupDetail', params: { id: 'g1' } } as never} />));

  it('shows balances, who pays whom and the activity', async () => {
    await show();
    expect(await screen.findByText('Ravi pays Priya')).toBeTruthy();
    expect(screen.getByText('You pay Priya')).toBeTruthy();
    expect(screen.getByText('+2,700')).toBeTruthy();
    expect(await screen.findByText("Dinner at Fisherman's Wharf")).toBeTruthy();
    expect(screen.getByText('Group expenses aren’t added to your spending.')).toBeTruthy();
  });

  it('records a suggested payment from the settle-up sheet, filled in', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: /Ravi pays Priya ₹1,500/ }));
    expect(await screen.findByText('Ravi owes Priya ₹1,500 in this group')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(requests.some((r) => r.path === '/v1/groups/g1/payments')).toBe(true));
    expect(requests.find((r) => r.path === '/v1/groups/g1/payments')?.body).toEqual({ fromId: 'ravi', toId: 'priya', amountPaise: 1500_00, day: TODAY });
  });

  it('says when everyone is settled up', async () => {
    detail = goa({ balances: members.map((m) => ({ memberId: m.id, netPaise: 0 })), transfers: [], settled: true, myNetPaise: 0 });
    await show();
    expect(await screen.findByText('All settled up')).toBeTruthy();
    expect(screen.getByText('Nobody owes anything')).toBeTruthy();
  });
});

describe('GroupExpenseFormScreen', () => {
  const show = (n = nav()) =>
    render(wrap(<GroupExpenseFormScreen navigation={n as never} route={{ key: 'k', name: 'GroupExpenseForm', params: { groupId: 'g1' } } as never} />));
  const typeAmount = async (digits: string) => {
    for (const d of digits) await fireEvent.press(screen.getByRole('button', { name: d }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  };

  it('splits equally with the leftover paisa to the first member, and saves', async () => {
    const n = nav();
    await show(n);
    await fireEvent.changeText(await screen.findByLabelText('Description'), 'Coconut water');
    await typeAmount('100');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Arjun' }));
    expect(screen.getByText('₹33.34')).toBeTruthy();
    expect(screen.getAllByText('₹33.33')).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(n.goBack).toHaveBeenCalled());
    expect(requests.find((r) => r.path === '/v1/groups/g1/expenses')?.body).toEqual({
      description: 'Coconut water',
      amountPaise: 100_00,
      day: TODAY,
      paidById: 'you',
      splitMode: 'equal',
      memberIds: ['you', 'ravi', 'priya'],
    });
  });

  it('keeps Save off until exact amounts add up', async () => {
    await show();
    await fireEvent.changeText(await screen.findByLabelText('Description'), 'Hotel');
    await typeAmount('1800');
    await fireEvent.press(screen.getByRole('radio', { name: 'Exact amounts' }));
    await fireEvent.changeText(screen.getByLabelText("You's share in rupees"), '600');
    await fireEvent.changeText(screen.getByLabelText("Ravi's share in rupees"), '600');
    await fireEvent.changeText(screen.getByLabelText("Priya's share in rupees"), '480');
    expect(screen.getByText('₹120 left')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save expense' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Arjun's share in rupees"), '120');
    expect(screen.getByText('Adds up to the total')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save expense' })).toBeEnabled();
  });
});
