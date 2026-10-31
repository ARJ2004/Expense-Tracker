import type { NormalizedTxn } from '@et/domain';

/**
 * One template per bank's SMS formats. Runs on the phone (and in Node for tests). match() returns
 * null for anything that is not a completed debit or credit: OTPs, offers, balance-only alerts,
 * payment requests, failed attempts. The NormalizedTxn it returns never carries the SMS body.
 */
export interface SmsTemplate {
  /** "hdfc", "sbi", ... */
  id: string;
  /** Matches the sender header, e.g. "VM-HDFCBK". Banks send from "XX-NAME" headers, never phone numbers. */
  sender: RegExp;
  match(body: string, receivedAt: Date): NormalizedTxn | null;
}
