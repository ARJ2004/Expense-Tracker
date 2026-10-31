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
 * only reads: it filters by bank-style senders on the device and never writes or sends SMS.
 */
export interface Spec extends TurboModule {
  /**
   * Inbox messages received after `sinceMs`, oldest first, at most `limit`, from senders that look
   * like bank headers ("XX-NAME"). Rejects with E_PERMISSION without READ_SMS.
   */
  readInbox(sinceMs: number, limit: number): Promise<InboxMessage[]>;
  /** True when this build declares READ_SMS (debug and sideloaded builds; not Play builds yet). */
  isDeclared(): boolean;
}

/** Null where the module does not exist (iOS, tests): SMS capture is Android only. */
export default TurboModuleRegistry.get<Spec>('SmsInbox');
