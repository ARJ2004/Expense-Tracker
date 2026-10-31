/**
 * The auth middleware: Bearer header, one shared refresh for parallel 401s, replay with the new
 * token, and dropping to Sign in when the refresh is refused.
 */
type Handler = (req: Request) => Response | Promise<Response>;
let handler: Handler;
const fetchMock = jest.fn((input: Request) => Promise.resolve(handler(input)));
(globalThis as { fetch: unknown }).fetch = fetchMock;

// Required after the fetch mock so openapi-fetch picks it up.
const { api, sessionTokens, secureStore } = require('../src/lib') as typeof import('../src/lib');

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const me = { id: 'u1', email: 'a@b.co', name: null, monthlyIncomePaise: null, incomeFrequency: null, onboarded: true, currency: 'INR', timezone: 'Asia/Kolkata' };

beforeEach(async () => {
  fetchMock.mockClear();
  await sessionTokens.save({ accessToken: 'old-access', refreshToken: 'refresh-1' });
});

it('sends the access token', async () => {
  handler = () => json(200, { items: [] });
  await api.GET('/v1/accounts');
  expect(fetchMock.mock.calls[0]?.[0].headers.get('Authorization')).toBe('Bearer old-access');
});

it('refreshes once for parallel 401s and replays each request with the new token', async () => {
  let refreshCalls = 0;
  handler = async (req) => {
    if (req.url.endsWith('/v1/auth/refresh')) {
      refreshCalls++;
      return json(200, { accessToken: 'new-access', refreshToken: 'refresh-2', expiresIn: 900, user: me });
    }
    return req.headers.get('Authorization') === 'Bearer new-access' ? json(200, { items: [] }) : json(401, { error: { code: 'AUTH_UNAUTHENTICATED', message: 'x' } });
  };
  const results = await Promise.all([api.GET('/v1/accounts'), api.GET('/v1/me'), api.GET('/v1/accounts')]);
  expect(refreshCalls).toBe(1);
  expect(results.every((r) => r.response.status === 200)).toBe(true);
  expect(sessionTokens.access()).toBe('new-access');
  expect(await secureStore.getRefreshToken()).toBe('refresh-2');
});

it('clears tokens and signals expiry when the refresh is refused', async () => {
  const expired = jest.fn();
  sessionTokens.onExpired(expired);
  handler = () => json(401, { error: { code: 'AUTH_REFRESH_REUSED', message: 'x' } });
  const { response } = await api.GET('/v1/me');
  expect(response.status).toBe(401);
  expect(expired).toHaveBeenCalledTimes(1);
  expect(sessionTokens.access()).toBeNull();
  expect(await secureStore.getRefreshToken()).toBeNull();
});
