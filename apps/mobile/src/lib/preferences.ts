import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';

/** Device-only display preferences. Never synced: each phone keeps its own look. */
const storage = createMMKV({ id: 'preferences' });
const APPEARANCE = 'appearance';

export type Appearance = 'system' | 'light' | 'dark';

const isAppearance = (v: unknown): v is Appearance => v === 'system' || v === 'light' || v === 'dark';

interface PreferencesState {
  /** "system" follows the phone's light/dark setting. */
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

export const usePreferences = create<PreferencesState>((set) => ({
  appearance: ((v) => (isAppearance(v) ? v : 'system'))(storage.getString(APPEARANCE)),
  setAppearance: (appearance) => {
    storage.set(APPEARANCE, appearance);
    set({ appearance });
  },
}));
