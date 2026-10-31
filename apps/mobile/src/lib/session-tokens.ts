import { secureStore } from './secure-store';

/** The access token lives only in memory; the refresh token in the keychain. */
let accessToken: string | null = null;
let expiredListener: (() => void) | null = null;

export const sessionTokens = {
  access(): string | null {
    return accessToken;
  },

  async save(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
    accessToken = tokens.accessToken;
    await secureStore.setRefreshToken(tokens.refreshToken);
  },

  async clear(): Promise<void> {
    accessToken = null;
    await secureStore.clearRefreshToken();
  },

  /** The auth feature registers here to drop back to Sign in when a refresh is refused. */
  onExpired(listener: () => void): void {
    expiredListener = listener;
  },

  notifyExpired(): void {
    expiredListener?.();
  },
};
