import type { ErrorEvent } from '@sentry/node';
import { initSentry, scrubEvent } from './sentry';

describe('sentry', () => {
  it('stays off without a DSN', () => {
    expect(initSentry({})).toBe(false);
  });

  it('drops bodies, headers, cookies, query strings and everything but the user id', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: 'POST',
        url: 'https://api.altus.in/v1/imports?accountId=abc',
        data: '{"narration":"UPI-SWIGGY"}',
        headers: { authorization: 'Bearer secret' },
        cookies: { a: 'b' },
        query_string: 'accountId=abc',
      },
      user: { id: 'u1', email: 'asha@example.com', ip_address: '1.2.3.4' },
      extra: { body: 'x' },
    } as ErrorEvent);
    expect(event.request).toEqual({ method: 'POST', url: 'https://api.altus.in/v1/imports' });
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.extra).toBeUndefined();
  });
});
