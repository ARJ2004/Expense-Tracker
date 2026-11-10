import { create } from 'zustand';
import type { AuthResponse, Me } from '@et/api-client';
import { api, queryClient, refreshSession, runBeforeSignOut, secureStore, sessionTokens } from '../../lib';
import { signOutOfGoogle } from './google';

export type SessionStatus = 'booting' | 'offline' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  user: Me | null;
  /** On launch: trade the stored refresh token for a session, or land on Sign in. */
  boot: () => Promise<void>;
  signedIn: (auth: AuthResponse) => Promise<void>;
  setUser: (user: Me) => void;
  signOut: () => Promise<void>;
  /** The API refused our refresh token: drop everything and show Sign in. */
  expired: () => void;
  /** The account was deleted on the server: forget the tokens and cache locally, no logout call. */
  deleted: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  user: null,

  boot: async () => {
    set({ status: 'booting' });
    try {
      const auth = await refreshSession();
      set(auth ? { status: 'signedIn', user: auth.user } : { status: 'signedOut', user: null });
    } catch {
      set({ status: 'offline' });
    }
  },

  signedIn: async (auth) => {
    await sessionTokens.save(auth);
    set({ status: 'signedIn', user: auth.user });
  },

  setUser: (user) => set({ user }),

  signOut: async () => {
    await runBeforeSignOut();
    const refreshToken = await secureStore.getRefreshToken();
    // Best effort: signing out must work offline too.
    if (refreshToken) await api.POST('/v1/auth/logout', { body: { refreshToken } }).catch(() => undefined);
    await sessionTokens.clear();
    await signOutOfGoogle();
    queryClient.clear();
    set({ status: 'signedOut', user: null });
  },

  expired: () => {
    queryClient.clear();
    set({ status: 'signedOut', user: null });
  },

  deleted: async () => {
    await sessionTokens.clear();
    await signOutOfGoogle();
    queryClient.clear();
    set({ status: 'signedOut', user: null });
  },
}));

sessionTokens.onExpired(() => useSession.getState().expired());
