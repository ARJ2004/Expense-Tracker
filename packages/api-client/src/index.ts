import createClient, { type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './schema';

export type { components, paths };
export type HealthResponse = components['schemas']['HealthResponse'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

/** Creates a typed client for the Expense Tracker API; every path, body and response is checked. */
export function createApiClient(options: ClientOptions & { baseUrl: string }) {
  return createClient<paths>(options);
}

export type ApiClient = ReturnType<typeof createApiClient>;
