import { createApiClient, type AuthResponse, type Middleware } from '@et/api-client';
import { API_BASE_URL } from './config';
import { secureStore } from './secure-store';
import { sessionTokens } from './session-tokens';

/** Routes that must never carry a stale token or trigger a refresh. */
const NO_REFRESH = new Set(['/v1/auth/google', '/v1/auth/refresh', '/v1/auth/logout']);

/** Bare client for the refresh call itself, so it can't recurse through the middleware. */
const plain = createApiClient({ baseUrl: API_BASE_URL });

let refreshing: Promise<AuthResponse | null> | null = null;

/**
 * Swaps the stored refresh token for a new pair. Concurrent callers share one request.
 * Resolves null (and clears the tokens) when the API refuses the token; throws when offline.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await secureStore.getRefreshToken();
      if (!refreshToken) return null;
      const deviceId = await secureStore.getDeviceId();
      const { data, response } = await plain.POST('/v1/auth/refresh', { body: { refreshToken, deviceId } });
      if (data) {
        await sessionTokens.save(data);
        return data;
      }
      if (response.status === 401) {
        await sessionTokens.clear();
        return null;
      }
      throw new Error(`Refresh failed with ${response.status}`);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Adds the Bearer token; on a 401 refreshes once and replays the request. */
export const authMiddleware: Middleware = (() => {
  const replayable = new Map<string, Request>();
  return {
    onRequest({ request, schemaPath, id }) {
      const token = sessionTokens.access();
      if (token && schemaPath !== '/v1/auth/google' && schemaPath !== '/v1/auth/refresh') {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      if (!NO_REFRESH.has(schemaPath)) replayable.set(id, request.clone());
      return request;
    },
    async onResponse({ response, id }) {
      const original = replayable.get(id);
      replayable.delete(id);
      if (response.status !== 401 || !original) return response;
      let session: AuthResponse | null;
      try {
        session = await refreshSession();
      } catch {
        return response;
      }
      if (!session) {
        sessionTokens.notifyExpired();
        return response;
      }
      original.headers.set('Authorization', `Bearer ${session.accessToken}`);
      return fetch(original);
    },
    onError({ id }) {
      replayable.delete(id);
    },
  };
})();

/** The only way screens reach the API: feature hooks call this typed client. */
export const api = createApiClient({ baseUrl: API_BASE_URL });
api.use(authMiddleware);
