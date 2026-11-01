import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { bankSenderPatterns } from '@et/parsers';
import SmsInbox from '../../native/NativeSmsInbox';

/** Device-only SMS capture state. Never synced: the choice and progress belong to this phone. */
const storage = createMMKV({ id: 'sms-capture' });
const OWNER = 'ownerUserId';
const ENABLED = 'enabled';
const WATERMARK = 'watermarkMs';
const LAST_SYNC = 'lastSyncMs';

/** The only senders the native module reads; every other message stays unread in Android. */
export const BANK_SENDERS = bankSenderPatterns();

/** Tells the native SMS receiver whether to wake a sync (it can't read this store). */
export function mirrorLiveCapture(enabled: boolean): void {
  SmsInbox?.setLiveCapture(enabled, BANK_SENDERS);
}

export interface SyncProgress {
  read: number;
  total: number;
}

interface SmsCaptureState {
  /** The user turned capture on (after the disclosure and the Android permission). */
  enabled: boolean;
  /** Receive time of the newest SMS already handled. */
  watermarkMs: number | null;
  lastSyncMs: number | null;
  /** A sync reading many messages (the first 90 days): how far it is. Not stored. */
  progress: SyncProgress | null;
  setProgress: (progress: SyncProgress | null) => void;
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
  progress: null,
  setProgress: (progress) => set({ progress }),
  setEnabled: (enabled) => {
    storage.set(ENABLED, enabled);
    mirrorLiveCapture(enabled);
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
    mirrorLiveCapture(false);
    set({ enabled: false, watermarkMs: null, lastSyncMs: null, progress: null });
  },
}));
