import type { NormalizedTxn } from '@et/domain';

/**
 * One template per bank SMS format. Runs on the phone (and in Node for tests);
 * returns null for OTPs, promotions and balance-only alerts.
 */
export interface SmsTemplate {
  id: string;
  sender: RegExp;
  match(body: string, receivedAt: Date): NormalizedTxn | null;
}

export const smsTemplates: SmsTemplate[] = [];

export function parseSms(sender: string, body: string, receivedAt: Date): NormalizedTxn | null {
  for (const template of smsTemplates) {
    if (!template.sender.test(sender)) continue;
    const txn = template.match(body, receivedAt);
    if (txn) return txn;
  }
  return null;
}
