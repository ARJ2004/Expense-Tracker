import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';

/** Device-only SMS capture state. Never synced: the choice and progress belong to this phone. */
const storage = createMMKV({ id: 'sms-capture' });
const OWNER = 'ownerUserId';
const ENABLED = 'enabled';
const WATERMARK = 'watermarkMs';
const LAST_SYNC = 'lastSyncMs';

interface SmsCaptureState {
  /** The user turned capture on (after the disclosure and the Android permission). */
  enabled: boolean;
  /** Receive time of the newest SMS already handled. */
  watermarkMs: number | null;
  lastSyncMs: number | null;
  setEnabled: (enabled: boolean) => void;
  setWatermark: (ms: number) => void;
  setLastSync: (ms: number) => void;
  /**
   * The state belongs to whoever turned capture on. When another user signs in on this phone it
   * starts off: they see the disclosure and choose for themselves.
   */
  claim: (userId: string) => void;
  /** Turning capture off forgets progress, so turning it on again re-reads (the API skips repeats). */
  reset: () => void;
}

const read = () => ({
  enabled: storage.getBoolean(ENABLED) ?? false,
  watermarkMs: storage.getNumber(WATERMARK) ?? null,
  lastSyncMs: storage.getNumber(LAST_SYNC) ?? null,
});

export const useSmsCapture = create<SmsCaptureState>((set, get) => ({
  ...read(),
  setEnabled: (enabled) => {
    storage.set(ENABLED, enabled);
    set({ enabled });
  },
  setWatermark: (ms) => {
    storage.set(WATERMARK, ms);
    set({ watermarkMs: ms });
  },
  setLastSync: (ms) => {
    storage.set(LAST_SYNC, ms);
    set({ lastSyncMs: ms });
  },
  claim: (userId) => {
    if (storage.getString(OWNER) === userId) return;
    get().reset();
    storage.set(OWNER, userId);
  },
  reset: () => {
    storage.remove(ENABLED);
    storage.remove(WATERMARK);
    storage.remove(LAST_SYNC);
    set({ enabled: false, watermarkMs: null, lastSyncMs: null });
  },
}));
