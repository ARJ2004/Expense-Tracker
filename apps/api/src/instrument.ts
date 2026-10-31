import { initSentry } from './common/observability/sentry';

// Loaded first in main.ts so Sentry can hook Node's modules before Nest imports them.
initSentry();
