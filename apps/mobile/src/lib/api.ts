import { createApiClient } from '@et/api-client';
import { API_BASE_URL } from './config';

/** The only way screens reach the API: feature hooks call this typed client. */
export const api = createApiClient({ baseUrl: API_BASE_URL });
