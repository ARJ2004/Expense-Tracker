import createClient, { type ClientOptions, type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

export type { components, paths, Middleware };
export type HealthResponse = components['schemas']['HealthResponse'];
export type ErrorResponse = components['schemas']['ErrorResponse'];
export type AuthResponse = components['schemas']['AuthResponse'];
export type Me = components['schemas']['MeDto'];
export type Account = components['schemas']['AccountDto'];
export type CreateAccount = components['schemas']['CreateAccountDto'];
export type IncomeFrequency = components['schemas']['IncomeFrequency'];
export type AccountKind = components['schemas']['AccountKind'];
export type UpdateAccount = components['schemas']['UpdateAccountDto'];
export type Category = components['schemas']['CategoryDto'];
export type CategoryIcon = components['schemas']['CategoryIcon'];
export type CategoryColor = components['schemas']['CategoryColor'];
export type Direction = components['schemas']['Direction'];
export type SourceKind = components['schemas']['SourceKind'];
export type TransactionSummary = components['schemas']['TransactionSummaryDto'];
export type TransactionDetail = components['schemas']['TransactionDetailDto'];
export type CreateTransaction = components['schemas']['CreateTransactionDto'];
export type UpdateTransaction = components['schemas']['UpdateTransactionDto'];

/** Creates a typed client for the Expense Tracker API; every path, body and response is checked. */
export function createApiClient(options: ClientOptions & { baseUrl: string }) {
  return createClient<paths>(options);
}

export type ApiClient = ReturnType<typeof createApiClient>;
