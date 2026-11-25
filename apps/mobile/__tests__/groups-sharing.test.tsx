import React from 'react';
import { Alert, Linking, Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const members = [
  { id: 'asha', name: 'Asha', isSelf: true, joined: true, isOwner: true },
  { id: 'ravi', name: 'Ravi', isSelf: false, joined: false, isOwner: false },
  { id: 'priya', name: 'Priya', isSelf: false, joined: true, isOwner: false },
];
const group = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  name: 'Goa trip',
  emoji: '🏖️',
  archived: false,
  rev: 3,
  myMemberId: 'asha',
  isOwner: true,
  members,
  balances: members.map((m) => ({ memberId: m.id, netPaise: 0 })),
  transfers: [],
  settled: true,
  totalSpentPaise: 0,
  mySharePaise: 0,
  myNetPaise: 0,
  ...over,
});
const invite = { code: 'K7Q2M9XP4R', displayCode: 'K7Q2-M9XP4R', url: 'http://15.252.181.82/altus/j/K7Q2M9XP4R' };
const preview = {
  groupId: 'g1',
  groupName: 'Goa trip',
  emoji: '🏖️',
  invitedBy: 'Asha',
  alreadyMember: false,
  members: members.map(({ id, name, joined }) => ({ id, name, joined })),
};

let previewStatus = 200;
let acceptStatus = 200;
let inviteState: unknown = { active: false };
const requests: Array<{ method: string; path: string; body?: unknown }> = [];

(globalThis as { fetch: unknown }).fetch = jest.fn(async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = new URL(req.url).pathname;
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json();
  requests.push({ method: req.method, path, body });
  if (path === '/v1/invites/K7Q2M9XP4R') {
    return previewStatus === 200 ? json(200, preview) : json(404, { error: { code: 'INVITE_NOT_FOUND', message: 'gone' } });
  }
  if (path === '/v1/invites/K7Q2M9XP4R/accept') {
    return acceptStatus === 200 ? json(200, group({ isOwner: false })) : json(409, { error: { code: 'GROUP_MEMBER_ALREADY_LINKED', message: 'taken' } });
  }
  if (path === '/v1/groups/g1/invite' && req.method === 'GET') return json(200, inviteState);
  if (path === '/v1/groups/g1/invite' && req.method === 'POST') return json(201, invite);
  if (path === '/v1/groups/g1/history') {
    return json(200, {
      items: [
        { id: 'h2', type: 'expense.updated', actorName: 'Priya', actorIsSelf: false, text: 'changed Dinner from ₹3,600 to ₹3,200', createdAt: new Date().toISOString() },
        { id: 'h1', type: 'expense.created', actorName: 'Asha', actorIsSelf: true, text: 'added Dinner · ₹3,600', createdAt: new Date().toISOString() },
      ],
      nextCursor: null,
    });
  }
  if (path === '/v1/groups/g1') return json(200, group());
  return json(404, { error: { code: 'NOT_FOUND', message: path } });
});

const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const groups = require('../src/features/groups') as typeof import('../src/features/groups');
const { InviteCard, inviteMessage } = require('../src/features/groups/components/InviteCard') as typeof import('../src/features/groups/components/InviteCard');
const { JoinWithCodeSheet } = require('../src/features/groups/components/JoinWithCodeSheet') as typeof import('../src/features/groups/components/JoinWithCodeSheet');
const { myGroupName } = require('../src/features/groups/labels') as typeof import('../src/features/groups/labels');
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
  previewStatus = 200;
  acceptStatus = 200;
  inviteState = { active: false };
  groups.usePendingJoin.getState().take();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('join links', () => {
  it('reads the code from every kind of link, and nothing else', () => {
    expect(groups.joinCodeFromUrl('http://15.252.181.82/altus/j/K7Q2M9XP4R')).toBe('K7Q2M9XP4R');
    expect(groups.joinCodeFromUrl('altus://j/k7q2m9xp4r')).toBe('K7Q2M9XP4R');
    expect(groups.joinCodeFromUrl('altus://settings')).toBeNull();
    expect(groups.joinCodeFromUrl('http://15.252.181.82/altus/j/oops')).toBeNull();
    expect(groups.joinCodeFromUrl(null)).toBeNull();
  });

  it('keeps a code from a link that arrives before sign-in, and hands it over once', async () => {
    const listeners: Array<(e: { url: string }) => void> = [];
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.spyOn(Linking, 'addEventListener').mockImplementation(((_: string, fn: (e: { url: string }) => void) => {
      listeners.push(fn);
      return { remove: jest.fn() };
    }) as never);
    function Root() {
      groups.useJoinLinkCapture();
      return null;
    }
    await render(<Root />);
    await act(async () => listeners[0]?.({ url: 'http://15.252.181.82/altus/j/K7Q2M9XP4R' }));
    expect(groups.usePendingJoin.getState().code).toBe('K7Q2M9XP4R');

    const open = jest.fn();
    function Main() {
      groups.useOpenPendingJoin(open);
      return null;
    }
    await render(<Main />);
    expect(open).toHaveBeenCalledWith('K7Q2M9XP4R');
    expect(groups.usePendingJoin.getState().code).toBeNull();
  });

  it('names me by my first name in groups', () => {
    expect(myGroupName({ name: 'Asha Rao', email: 'asha@example.com' })).toBe('Asha');
    expect(myGroupName({ name: null, email: 'ravi.k@example.com' })).toBe('ravi.k');
    expect(myGroupName(null)).toBe('Me');
  });
});

describe('JoinGroupScreen', () => {
  const show = (n = nav()) => render(wrap(<groups.JoinGroupScreen navigation={n as never} route={{ key: 'k', name: 'JoinGroup', params: { code: 'K7Q2M9XP4R' } } as never} />));

  it('shows the group and the names still free, and joins as the one I pick', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    const n = nav();
    await show(n);
    expect(await screen.findByText('Asha invited you')).toBeTruthy();
    expect(screen.getByText('🏖️ Goa trip')).toBeTruthy();
    expect(screen.getByText('ALREADY JOINED')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "I'm Ravi" }));
    await waitFor(() => expect(n.replace).toHaveBeenCalledWith('GroupDetail', { id: 'g1' }));
    expect(requests.find((r) => r.path.endsWith('/accept'))?.body).toEqual({ memberId: 'ravi' });
    alert.mockRestore();
  });

  it('says so when someone took the name first, and reloads the names', async () => {
    acceptStatus = 409;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: "I'm Ravi" }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Couldn’t join', expect.any(String)));
    await waitFor(() => expect(requests.filter((r) => r.path === '/v1/invites/K7Q2M9XP4R')).toHaveLength(2));
    alert.mockRestore();
  });

  it('joins as a new name when I am not on the list', async () => {
    await show();
    await fireEvent.press(await screen.findByRole('button', { name: "I'm not on the list" }));
    await waitFor(() => expect(requests.find((r) => r.path.endsWith('/accept'))?.body).toEqual({ name: 'Me' }));
  });

  it('explains a link that was turned off', async () => {
    previewStatus = 404;
    await show();
    expect(await screen.findByText('This link doesn’t work any more')).toBeTruthy();
  });
});

describe('InviteCard', () => {
  it('makes the link on first share and sends it with the code', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await render(wrap(<InviteCard group={group() as never} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Share invite link' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ message: inviteMessage('Goa trip', invite.url, invite.displayCode) }));
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ reset: false });
    expect(await screen.findByText('K7Q2-M9XP4R')).toBeTruthy();
    share.mockRestore();
  });

  it('lets the owner reset the link', async () => {
    inviteState = { active: true, invite };
    await render(wrap(<InviteCard group={group() as never} />));
    expect(await screen.findByRole('button', { name: 'Reset link' })).toBeTruthy();
  });

  it('shows other members the link but not reset', async () => {
    inviteState = { active: true, invite };
    await render(wrap(<InviteCard group={group({ isOwner: false }) as never} />));
    expect(await screen.findByText('K7Q2-M9XP4R')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset link' })).toBeNull();
  });
});

describe('JoinWithCodeSheet', () => {
  it('accepts a typed code with a dash, or a pasted link', async () => {
    const onCode = jest.fn();
    await render(wrap(<JoinWithCodeSheet visible onClose={jest.fn()} onCode={onCode} />));
    await fireEvent.changeText(screen.getByLabelText('Code'), 'k7q2-m9xp4r');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onCode).toHaveBeenCalledWith('K7Q2M9XP4R');
  });
});

describe('GroupHistoryScreen', () => {
  it('says who did what, with You for me', async () => {
    await render(wrap(<groups.GroupHistoryScreen navigation={nav() as never} route={{ key: 'k', name: 'GroupHistory', params: { id: 'g1' } } as never} />));
    expect(await screen.findByText('Priya changed Dinner from ₹3,600 to ₹3,200')).toBeTruthy();
    expect(screen.getByText('You added Dinner · ₹3,600')).toBeTruthy();
  });
});
