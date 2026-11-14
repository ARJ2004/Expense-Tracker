import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addDays, istDateKey } from '@et/domain';

const TODAY = istDateKey(new Date());
const food = { id: '00000000-0000-7000-8000-000000000001', name: 'Food & Dining', icon: 'food', color: 'chart2' };
const rent = { id: '00000000-0000-7000-8000-000000000006', name: 'Rent', icon: 'rent', color: 'chart1' };

const allowance = { day: TODAY, allowancePaise: 130_000, spentTodayPaise: 30_000, leftTodayPaise: 100_000, daysLeft: 20, basis: 'income', fixedReservePaise: 1_500_000, goalReservePaise: 0 };
const overview = {
  month: TODAY.slice(0, 7),
  items: [
    { category: food, amountPaise: 800_000, isFixed: false, spentPaise: 900_000, usedPercent: 112, state: 'over', projectedPaise: null, overshootPaise: 0 },
    { category: rent, amountPaise: 1_500_000, isFixed: true, spentPaise: 0, usedPercent: 0, state: 'ok', projectedPaise: null, overshootPaise: 0 },
  ],
  totalBudgetPaise: 2_300_000,
  totalSpentPaise: 900_000,
  unbudgetedSpentPaise: 25_000,
  allowance,
};
const rewards = {
  streak: { current: 4, best: 6 },
  last14: [{ day: addDays(TODAY, -1), allowancePaise: 130_000, spentPaise: 40_000, underBudget: true }],
  badges: [
    { code: 'first_budget', emoji: '🎯', title: 'Planner', description: 'Set your first budget', unlockedAt: `${TODAY}T05:00:00.000Z` },
    { code: 'streak_7', emoji: '⚡', title: 'Week under budget', description: '7 days in a row within your allowance', unlockedAt: null },
  ],
};
const settings = {
  pushEnabled: false,
  items: [
    { type: 'morning_allowance', group: 'daily', label: 'Morning allowance', description: '9 am', enabled: true },
    { type: 'big_spend', group: 'alerts', label: 'Big spends', description: 'Bigger than usual', enabled: true },
  ],
};
const requests: Array<{ method: string; path: string; body?: unknown }> = [];

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = new URL(req.url).pathname;
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json().catch(() => undefined);
  requests.push({ method: req.method, path, body });
  if (path === '/v1/budgets' && req.method === 'GET') return json(200, overview);
  if (path.startsWith('/v1/budgets/') && req.method === 'PUT') return json(200, { ...overview.items[0], ...(body as object) });
  if (path === '/v1/rewards') return json(200, rewards);
  if (path === '/v1/categories') return json(200, { items: [{ ...food, isExpense: true, system: true }, { ...rent, isExpense: true, system: true }, { id: 'c3', name: 'Shopping', icon: 'shopping', color: 'warning', isExpense: true, system: true }] });
  if (path === '/v1/notifications/settings' && req.method === 'GET') return json(200, settings);
  if (path === '/v1/notifications/settings' && req.method === 'PUT') return json(200, settings);
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { AllowanceCard, BudgetsScreen } = require('../src/features/budgets') as typeof import('../src/features/budgets');
const { budgetMeta, allowanceLine } = require('../src/features/budgets/labels') as typeof import('../src/features/budgets/labels');
const { RewardsScreen } = require('../src/features/rewards') as typeof import('../src/features/rewards');
const { NotificationSettingsScreen, openNotificationTarget } = require('../src/features/notifications') as typeof import('../src/features/notifications');
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
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });

beforeEach(() => {
  requests.length = 0;
});

describe('budget labels', () => {
  it('says what is left, over, on pace to overshoot, or fixed', async () => {
    const b = overview.items[0]!;
    expect(budgetMeta(b as never)).toBe('of ₹8,000 · ₹1,000 over');
    expect(budgetMeta({ ...b, spentPaise: 500_000, overshootPaise: 120_000 } as never)).toBe('of ₹8,000 · on pace to go ₹1,200 over');
    expect(budgetMeta({ ...b, spentPaise: 500_000 } as never)).toBe('of ₹8,000 · ₹3,000 left');
    expect(budgetMeta(overview.items[1] as never)).toBe('Fixed · of ₹15,000');
  });

  it('words the allowance line', async () => {
    expect(allowanceLine(allowance as never)).toBe('of ₹1,300 today · 20 days left this month');
    expect(allowanceLine({ ...allowance, leftTodayPaise: -20_000 } as never)).toContain('₹200 over');
    expect(allowanceLine({ ...allowance, allowancePaise: 0 } as never)).toContain('used up');
  });
});

describe('AllowanceCard', () => {
  it('shows what is left today with the streak, and opens Budgets', async () => {
    const onOpen = jest.fn();
    await render(wrap(<AllowanceCard allowance={allowance as never} streak={4} onOpen={onOpen} onSetUp={jest.fn()} />));
    expect(screen.getByText('₹1,000')).toBeTruthy();
    expect(screen.getByText('🔥 4-day streak')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('invites a budget when there is no allowance', async () => {
    const onSetUp = jest.fn();
    await render(wrap(<AllowanceCard allowance={null} streak={0} onOpen={jest.fn()} onSetUp={onSetUp} />));
    await fireEvent.press(screen.getByText('Set a budget'));
    expect(onSetUp).toHaveBeenCalled();
  });
});

describe('BudgetsScreen', () => {
  it('lists budgets with their state, fixed costs apart, and the allowance', async () => {
    await render(wrap(<BudgetsScreen navigation={nav() as never} route={{ key: 'b', name: 'Budgets' } as never} />));
    expect(await screen.findByText('Food & Dining')).toBeTruthy();
    expect(screen.getByText('of ₹8,000 · ₹1,000 over')).toBeTruthy();
    expect(screen.getByText('FIXED COSTS')).toBeTruthy();
    expect(screen.getByText('Left to spend today')).toBeTruthy();
    expect(screen.getByText(/less ₹15,000 fixed costs/)).toBeTruthy();
    expect(screen.getByText('₹250')).toBeTruthy();
  });

  it('changes a budget from its sheet', async () => {
    await render(wrap(<BudgetsScreen navigation={nav() as never} route={{ key: 'b', name: 'Budgets' } as never} />));
    await fireEvent.press(await screen.findByLabelText(/Food & Dining, ₹9,000/));
    await fireEvent.press(await screen.findByText('Save budget'));
    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    expect(requests.find((r) => r.method === 'PUT')).toMatchObject({ path: `/v1/budgets/${food.id}`, body: { amountPaise: 800_000, isFixed: false } });
  });
});

describe('RewardsScreen', () => {
  it('shows the streak and badges, locked ones with how to earn them', async () => {
    await render(wrap(<RewardsScreen navigation={nav() as never} route={{ key: 'r', name: 'Rewards' } as never} />));
    expect(await screen.findByText('🔥 4 days')).toBeTruthy();
    expect(screen.getByText(/Best: 6 days/)).toBeTruthy();
    expect(screen.getByText('BADGES · 1 OF 2')).toBeTruthy();
    expect(screen.getByLabelText(/Week under budget, locked/)).toBeTruthy();
  });
});

describe('notifications', () => {
  it('switches a type off', async () => {
    await render(wrap(<NotificationSettingsScreen navigation={nav() as never} route={{ key: 'n', name: 'NotificationSettings' } as never} />));
    expect(await screen.findByText('Push isn’t set up on this phone yet')).toBeTruthy();
    await fireEvent.press((await screen.findAllByRole('switch'))[1]!);
    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({ disabledTypes: ['big_spend'] });
  });

  it('opens the screen a notification points at', async () => {
    const n = nav();
    openNotificationTarget(n as never, { screen: 'Goal', id: 'g1' });
    openNotificationTarget(n as never, { screen: 'Budgets' });
    openNotificationTarget(n as never, { screen: 'mystery' });
    expect(n.navigate.mock.calls).toEqual([['GoalDetail', { id: 'g1' }], ['Budgets'], ['Notifications']]);
  });
});
