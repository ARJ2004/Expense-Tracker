import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import type { CapturedTxn } from '@et/api-client';
import { isKnownBankSender, parseSender, transactionSenderPatterns } from '@et/parsers';
import SmsInbox from '../../native/NativeSmsInbox';
import { useSession } from '../auth';

/** Device-only SMS capture state. Never synced: the choice and progress belong to this phone. */
const storage = createMMKV({ id: 'sms-capture' });
const OWNER = 'ownerUserId';
const ENABLED = 'enabled';
const WATERMARK = 'watermarkMs';
const LAST_SYNC = 'lastSyncMs';
const READER = 'readerVersion';
const CATCH_UP = 'catchUpWatermarkMs';
const TRUSTED = 'trustedSenders';
const BLOCKED = 'blockedSenders';
const HELD = 'heldBySender';
/**
 * Which senders the inbox read covers. 1: the four bank templates' senders only. 2: every business
 * sender, read by wording. A watermark saved under an older version passed messages it never read.
 */
const READER_VERSION = 2;
/** At most this many transactions wait per new sender; the oldest go first. */
const HELD_PER_SENDER = 100;

/** The only senders the native module reads: businesses, never people or promotions. */
export const BANK_SENDERS = transactionSenderPatterns();

/** Tells the native SMS receiver whether to wake a sync (it can't read this store). */
export function mirrorLiveCapture(enabled: boolean): void {
  SmsInbox?.setLiveCapture(enabled, BANK_SENDERS);
}

/** A transaction from a sender the person hasn't confirmed yet: parsed fields only, never the SMS. */
export interface HeldTxn {
  item: CapturedTxn;
  receivedAt: number;
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
  /**
   * Bumped by every reset (Turn off, another user claiming the phone). A sync that started under an
   * older generation stops before its next read or send and never moves the watermark. Not stored.
   */
  generation: number;
  /** Sender codes ("SVCBNK") the person confirmed as their bank, or that named one of their accounts. */
  trusted: string[];
  /** Sender codes the person said aren't their bank: never read again. */
  blocked: string[];
  /** Transactions from new senders, waiting for "Is this your bank?", by sender code. */
  held: Record<string, HeldTxn[]>;
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
  trust: (code: string) => void;
  hold: (code: string, txn: HeldTxn) => void;
  /** "Yes, my bank" once its held transactions are sent: trusted from now on. */
  approve: (code: string) => void;
  /** "Not mine": its held transactions are dropped and it is never read again. */
  block: (code: string) => void;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const read = () => ({
  enabled: storage.getBoolean(ENABLED) ?? false,
  watermarkMs: storage.getNumber(WATERMARK) ?? null,
  lastSyncMs: storage.getNumber(LAST_SYNC) ?? null,
  trusted: readJson<string[]>(TRUSTED, []),
  blocked: readJson<string[]>(BLOCKED, []),
  held: readJson<Record<string, HeldTxn[]>>(HELD, {}),
});

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

export const useSmsCapture = create<SmsCaptureState>((set, get) => ({
  ...read(),
  progress: null,
  generation: 0,
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
    storage.remove(READER);
    storage.remove(CATCH_UP);
    storage.remove(COVERED_BY_1_2);
    storage.remove(TRUSTED);
    storage.remove(BLOCKED);
    storage.remove(HELD);
    mirrorLiveCapture(false);
    set({ enabled: false, watermarkMs: null, lastSyncMs: null, progress: null, trusted: [], blocked: [], held: {}, generation: get().generation + 1 });
  },
  trust: (code) => {
    if (get().trusted.includes(code)) return;
    const trusted = [...get().trusted, code];
    storage.set(TRUSTED, JSON.stringify(trusted));
    set({ trusted });
  },
  hold: (code, txn) => {
    const mine = get().held[code] ?? [];
    if (mine.some((h) => h.item.messageKey === txn.item.messageKey)) return;
    const held = { ...get().held, [code]: [...mine, txn].slice(-HELD_PER_SENDER) };
    storage.set(HELD, JSON.stringify(held));
    set({ held });
  },
  approve: (code) => {
    get().trust(code);
    const held = without(get().held, code);
    storage.set(HELD, JSON.stringify(held));
    set({ held });
  },
  block: (code) => {
    const blocked = get().blocked.includes(code) ? get().blocked : [...get().blocked, code];
    const held = without(get().held, code);
    storage.set(BLOCKED, JSON.stringify(blocked));
    storage.set(HELD, JSON.stringify(held));
    set({ blocked, held });
  },
}));

export type SenderDecision = 'send' | 'hold' | 'drop';

/**
 * What to do with a transaction from this sender. A bank we know, or one the person confirmed:
 * send. One that names an account the person already has (the last digits match): it is their
 * bank, trust it and send. Any other sender: hold until the person says it is their bank, so a
 * fake "₹5,000 credited" never reaches the ledger on its own. A sender they turned down: drop.
 */
export function senderDecision(sender: string, item: CapturedTxn, accountDigits: ReadonlySet<string>): SenderDecision {
  const code = parseSender(sender)?.code;
  const state = useSmsCapture.getState();
  if (!code || state.blocked.includes(code)) return 'drop';
  if (isKnownBankSender(sender) || state.trusted.includes(code)) return 'send';
  if (item.last4 && accountDigits.has(item.last4)) {
    state.trust(code);
    return 'send';
  }
  return 'hold';
}

/**
 * True when the watermark was saved by a reader that covered fewer senders: messages before it
 * from the others were never read, so the last 90 days are read once more for them (the API skips
 * anything already added). Never before the first sync, which reads everything anyway.
 */
export function needsCatchUp(): boolean {
  if (storage.getNumber(WATERMARK) === undefined) return false;
  return (storage.getNumber(READER) ?? 1) < READER_VERSION;
}

/**
 * Senders an older version already read up to the watermark: the catch-up leaves them alone. Its
 * fingerprints were made differently, so sending them again could add a payment twice.
 */
const READ_BEFORE = [/^[A-Z]{2}-HDFCB[KN]/i, /^[A-Z]{2}-(SBI|ATMSBI|SBICRD|CBSSBI)/i, /^[A-Z]{2}-ICICI[BT]/i, /^[A-Z]{2}-AXISB[KN]/i];
/** Version 1.2 also read SVC Bank, and said so in this key. */
const COVERED_BY_1_2 = 'coveredTemplates';

export function readBefore(sender: string): boolean {
  if (READ_BEFORE.some((p) => p.test(sender))) return true;
  return (storage.getString(COVERED_BY_1_2) ?? '').includes('"svc"') && /^([A-Z]{2}-){0,1}SVC/i.test(sender);
}

/** Every sender has been read up to the watermark. */
export function markCaughtUp(): void {
  storage.set(READER, READER_VERSION);
  storage.remove(CATCH_UP);
  storage.remove(COVERED_BY_1_2);
}

/** How far the catch-up read got, so an interrupted one resumes instead of starting over. */
export const catchUpWatermark = {
  get: (): number | null => storage.getNumber(CATCH_UP) ?? null,
  set: (ms: number): void => storage.set(CATCH_UP, ms),
};

/**
 * True while a sync started at `generation` may keep going: capture is still on and nothing reset
 * it since (Turn off, or another user signing in on this phone).
 */
export function syncStillAllowed(generation: number): boolean {
  const s = useSmsCapture.getState();
  return s.enabled && s.generation === generation;
}

// Capture belongs to whoever turned it on. Claim the moment someone signs in, before any screen
// (or a sync it starts) can run with the previous user's setting; another user starts with it off.
useSession.subscribe((state, prev) => {
  const id = state.user?.id;
  if (id && id !== prev.user?.id) useSmsCapture.getState().claim(id);
});
