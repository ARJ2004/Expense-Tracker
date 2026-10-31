import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from './config';

/**
 * Crash reporting, off unless SENTRY_DSN is set. Only the stack, device and app version go out:
 * no request bodies, no network breadcrumbs (URLs can carry ids), no console lines, no user
 * details, and never amounts or SMS text.
 */
export function initSentry(): boolean {
  if (!SENTRY_DSN) return false;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: (crumb) => (crumb.category === 'console' || crumb.category === 'fetch' || crumb.category === 'xhr' ? null : crumb),
    beforeSend: (event) => {
      delete event.request;
      delete event.user;
      delete event.extra;
      return event;
    },
  });
  return true;
}
