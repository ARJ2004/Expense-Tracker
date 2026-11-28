import { useEffect } from 'react';
import { Linking } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { normalizeInviteCode } from '@et/domain';

/**
 * Join links (http://15.252.181.82/altus/j/<code>, altus://j/<code>). A link can arrive before
 * sign-in or mid-onboarding, when the screens that join don't exist yet, so the code waits here
 * (kept across a restart) until the main app opens it. A code older than a week is dropped.
 */
const storage = createMMKV({ id: 'pending-join' });
const KEY = 'code';
const MAX_AGE_MS = 7 * 86_400_000;

interface Saved {
  code: string;
  at: number;
}

function load(): Saved | null {
  try {
    const raw = storage.getString(KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved && Date.now() - saved.at < MAX_AGE_MS ? saved : null;
  } catch {
    return null;
  }
}

interface PendingJoinState {
  code: string | null;
  set: (code: string) => void;
  /** Hands the code over once and forgets it. */
  take: () => string | null;
}

export const usePendingJoin = create<PendingJoinState>((set, get) => ({
  code: load()?.code ?? null,
  set: (code) => {
    storage.set(KEY, JSON.stringify({ code, at: Date.now() } satisfies Saved));
    set({ code });
  },
  take: () => {
    const { code } = get();
    if (code) {
      storage.remove(KEY);
      set({ code: null });
    }
    return code;
  },
}));

/** The join code in a link, or null when the link isn't one. */
export function joinCodeFromUrl(url: string | null | undefined): string | null {
  if (!url || !/(^altus:\/\/j\/|\/j\/)/i.test(url)) return null;
  return normalizeInviteCode(url);
}

/** Root of the app: catches join links that open or wake the app, signed in or not. */
export function useJoinLinkCapture(): void {
  useEffect(() => {
    const keep = (url: string | null | undefined) => {
      const code = joinCodeFromUrl(url);
      if (code) usePendingJoin.getState().set(code);
    };
    Linking.getInitialURL().then(keep, () => undefined);
    const sub = Linking.addEventListener('url', ({ url }) => keep(url));
    return () => sub.remove();
  }, []);
}

/** Inside the signed-in app: opens the join screen for a waiting code. */
export function useOpenPendingJoin(open: (code: string) => void): void {
  const code = usePendingJoin((s) => s.code);
  useEffect(() => {
    if (!code) return;
    const taken = usePendingJoin.getState().take();
    if (taken) open(taken);
  }, [code, open]);
}
