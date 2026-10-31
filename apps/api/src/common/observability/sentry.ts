import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';

/**
 * Crash reporting, off unless SENTRY_DSN is set. Events carry the stack and route only: request
 * bodies, headers, cookies and query strings can hold tokens, statements and amounts, so they're
 * dropped before anything leaves the server. Users appear by id only.
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: (crumb) => (crumb.category === 'console' ? null : { ...crumb, data: undefined }),
  });
  return true;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const { method, url } = event.request;
    event.request = { method, url: url?.split('?')[0] };
  }
  event.user = event.user?.id ? { id: event.user.id } : undefined;
  delete event.extra;
  return event;
}

/** Unexpected server errors only; a no-op when Sentry isn't configured. */
export function reportError(exception: unknown): void {
  Sentry.captureException(exception);
}
