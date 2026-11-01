import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addDays, goalProgress, istDateKey } from '@et/domain';

const TODAY = istDateKey(new Date());
const START = addDays(TODAY, -4);
type Saved = { day: string; amountPaise: number };

/** A goal as the API returns it, with progress worked out by the same function the API uses. */
function goal(saved: Saved[], over: Record<string, unknown> = {}) {
  const plan = { targetPaise: 5_000_000, startDay: START, targetDay: addDays(START, 90) };
  return {
    id: 'g1',
    name: 'New phone',
    emoji: '📱',
    ...plan,
    status: 'active',
    reachedAt: null,
    createdAt: `${START}T05:00:00.000Z`,
    progress: goalProgress(plan, saved, TODAY),
    contributions: saved.map((s, i) => ({ id: `c${i}`, ...s, createdAt: `${s.day}T05:00:00.000Z` })),
    ...over,
  };
}
const fourDays: Saved[] = [0, 1, 2, 3].map((d) => ({ day: addDays(START, d), amountPaise: 55_600 }));

let current = goal(fourDays);
let goals: unknown[] = [];
const requests: Array<{ method: string; path: string; body?: unknown }> = [];

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = new URL(req.url).pathname;
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json();
  requests.push({ method: req.method, path, body });
  if (path === '/v1/goals' && req.method === 'GET') return json(200, { items: goals });
  if (path === '/v1/goals' && req.method === 'POST') return json(201, goal([], body as Record<string, unknown>));
  if (path === '/v1/goals/g1' && req.method === 'GET') return json(200, current);
  if (path === '/v1/goals/g1/contributions') {
    const next = goal([...fourDays, { day: TODAY, amountPaise: (body as Saved).amountPaise }]);
    return json(201, { goal: next, newMilestones: ['saved-25'].filter(() => (body as Saved).amountPaise >= 1_000_000) });
  }
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const { GoalCard, GoalsOnHome, GoalDetailScreen, GoalFormScreen } = require('../src/features/goals') as typeof import('../src/features/goals');
const { closerLabel, scheduleLabel, streakLabel, headlineMilestone, planLabel } = require('../src/features/goals/labels') as typeof import('../src/features/goals/labels');
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
  current = goal(fourDays);
  goals = [];
});

describe('labels', () => {
  const p = (saved: Saved[]) => goal(saved).progress;

  it('says how close the goal is in days', () => {
    expect(closerLabel(p([]))).toBe('Save ₹556 a day to get there');
    expect(closerLabel(p(fourDays.slice(0, 1)))).toBe('1 day closer · 89 to go');
    expect(closerLabel(p(fourDays))).toBe('4 days closer · 86 to go');
  });

  it('says on track, ahead or behind, with the amount to catch up', () => {
    const g = goal(fourDays);
    expect(scheduleLabel(g, g.progress)).toBe('On track');
    const ahead = goal([{ day: START, amountPaise: 1_000_000 }]);
    expect(scheduleLabel(ahead, ahead.progress)).toMatch(/^\d+ days ahead$/);
    const behind = goal(fourDays.slice(0, 1));
    expect(scheduleLabel(behind, behind.progress)).toBe('3 days behind · ₹575 a day to catch up');
  });

  it('shows a streak only once there is one', () => {
    expect(streakLabel(0)).toBeNull();
    expect(streakLabel(4)).toBe('🔥 4-day streak');
  });

  it('celebrates reaching the goal over anything else', () => {
    expect(headlineMilestone(['saved-75', 'saved-100', 'streak-7'])).toBe('saved-100');
    expect(headlineMilestone(['saved-25', 'streak-3'])).toBe('streak-3');
    expect(headlineMilestone([])).toBeNull();
  });

  it('previews the plan the way it was asked for: ₹50,000 over 90 days', () => {
    expect(planLabel(55_600, 90, new Date('2027-01-30T06:30:00Z'))).toBe('₹556 a day for 90 days · until 30 Jan 2027');
  });
});

describe('GoalCard', () => {
  it('shows the streak, how close it is, and saves today in one tap', async () => {
    await render(wrap(<GoalCard goal={current as never} onOpen={jest.fn()} />));
    expect(screen.getByText('🔥 4-day streak')).toBeTruthy();
    expect(screen.getByText('4 days closer · 86 to go')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save ₹556 today' }));
    await waitFor(() => expect(requests.some((r) => r.path === '/v1/goals/g1/contributions')).toBe(true));
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ amountPaise: 55_600 });
  });

  it('says it is done for today once today is saved', async () => {
    const done = goal([...fourDays, { day: TODAY, amountPaise: 55_600 }]);
    await render(wrap(<GoalCard goal={done as never} onOpen={jest.fn()} />));
    expect(screen.getByText('✓ Saved ₹556 today')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save ₹556 today' })).toBeNull();
  });
});

describe('GoalsOnHome', () => {
  it('invites to set a goal when there are none', async () => {
    const onNew = jest.fn();
    await render(wrap(<GoalsOnHome onOpen={jest.fn()} onSeeAll={jest.fn()} onNew={onNew} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Set a goal' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('shows the two nearest goals', async () => {
    goals = [goal(fourDays), goal([], { id: 'g2', name: 'Trip' }), goal([], { id: 'g3', name: 'Watch' })];
    await render(wrap(<GoalsOnHome onOpen={jest.fn()} onSeeAll={jest.fn()} onNew={jest.fn()} />));
    expect(await screen.findByText('Your goals')).toBeTruthy();
    expect(screen.getByText(/New phone/)).toBeTruthy();
    expect(screen.getByText(/Trip/)).toBeTruthy();
    expect(screen.queryByText(/Watch/)).toBeNull();
  });
});

describe('GoalFormScreen', () => {
  it('works out ₹556 a day for ₹50,000 in 3 months and creates the goal', async () => {
    const navigation = nav();
    await render(wrap(<GoalFormScreen navigation={navigation as never} route={{ key: 'f', name: 'GoalForm', params: undefined } as never} />));
    await fireEvent.changeText(screen.getByLabelText('What are you saving for?'), 'New phone');
    await fireEvent.changeText(screen.getByLabelText('Goal amount in rupees'), '50000');
    expect(screen.getByText(/^₹556 a day for 90 days · until /)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start saving' }));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ name: 'New phone', targetPaise: 5_000_000, targetDay: addDays(TODAY, 90) });
  });

  it("can't start without a name and an amount", async () => {
    await render(wrap(<GoalFormScreen navigation={nav() as never} route={{ key: 'f', name: 'GoalForm', params: undefined } as never} />));
    expect(screen.getByRole('button', { name: 'Start saving' })).toBeDisabled();
  });
});

describe('GoalDetailScreen', () => {
  const mount = () => render(wrap(<GoalDetailScreen navigation={nav() as never} route={{ key: 'd', name: 'GoalDetail', params: { id: 'g1' } } as never} />));

  it('shows the streak, the last 14 days and what was put aside', async () => {
    await mount();
    expect(await screen.findByText('🔥 4-day streak')).toBeTruthy();
    expect(screen.getByText('4 days closer · 86 to go')).toBeTruthy();
    expect(screen.getByLabelText('Last 14 days')).toBeTruthy();
    expect(screen.getAllByText('₹556')).toHaveLength(4);
  });

  it('saves another amount and celebrates the milestone it reaches', async () => {
    await mount();
    await fireEvent.press(await screen.findByRole('button', { name: 'Another amount' }));
    await fireEvent.changeText(screen.getByLabelText('Amount put aside in rupees'), '12000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A quarter of the way there')).toBeTruthy();
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ amountPaise: 1_200_000 });
  });
});
