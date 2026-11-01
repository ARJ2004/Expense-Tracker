import { TurboModuleRegistry, type TurboModule } from 'react-native';

/** One message from the SMS inbox. The body is used on the phone only and never sent. */
export interface InboxMessage {
  sender: string;
  body: string;
  /** Epoch milliseconds the phone received it. */
  receivedAt: number;
}

/**
 * Codegen spec for the Android SmsInbox module (android/.../sms/SmsInboxModule.kt). The module
 * only reads: it keeps bank senders only, on the device, and never writes or sends SMS.
 */
export interface Spec extends TurboModule {
  /**
   * Inbox messages received after `sinceMs`, oldest first, at most `limit`, from senders matching
   * one of `senders` (regex sources from @et/parsers' bankSenderPatterns, case-insensitive). Any
   * other message is skipped before its text is read. Rejects with E_PERMISSION without READ_SMS.
   */
  readInbox(sinceMs: number, limit: number, senders: string[]): Promise<InboxMessage[]>;
  /** How many inbox messages after `sinceMs` come from one of `senders`; reads no message text. */
  countInbox(sinceMs: number, senders: string[]): Promise<number>;
  /**
   * Mirrors capture on/off and the bank sender patterns to Android, where the SMS receiver reads
   * them before any JavaScript runs: it wakes a sync only for a bank SMS while capture is on.
   */
  setLiveCapture(enabled: boolean, senders: string[]): void;
  /** True when this build declares READ_SMS (debug and sideloaded builds; not Play builds yet). */
  isDeclared(): boolean;
}

/** Null where the module does not exist (iOS, tests): SMS capture is Android only. */
export default TurboModuleRegistry.get<Spec>('SmsInbox');
