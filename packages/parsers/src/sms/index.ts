import type { NormalizedTxn } from '@et/domain';
import { isNotAPayment } from './helpers';
import type { SmsTemplate } from './template';
import { AxisSmsTemplate } from './templates/axis.sms';
import { HdfcSmsTemplate } from './templates/hdfc.sms';
import { IciciSmsTemplate } from './templates/icici.sms';
import { SbiSmsTemplate } from './templates/sbi.sms';

export type { SmsTemplate } from './template';
export { AxisSmsTemplate, HdfcSmsTemplate, IciciSmsTemplate, SbiSmsTemplate };
export { isNotAPayment, smsAmount } from './helpers';

/** Adding a bank = one template file + one entry here. Shared code never branches on the bank. */
export const smsTemplates: readonly SmsTemplate[] = [new HdfcSmsTemplate(), new SbiSmsTemplate(), new IciciSmsTemplate(), new AxisSmsTemplate()];

/**
 * Every bank's sender pattern as regex source, for the Android module to filter the inbox with:
 * a message from any other sender never leaves the phone's SMS store. Patterns use only syntax
 * that JavaScript and Kotlin read alike, and match case-insensitively.
 */
export function bankSenderPatterns(): string[] {
  return smsTemplates.map((t) => t.sender.source);
}

/** True when some template claims this sender; only those messages are ever read further. */
export function isBankSender(sender: string): boolean {
  return smsTemplates.some((t) => t.sender.test(sender));
}

/**
 * The transaction in one bank SMS, or null. Personal messages never reach a template (their
 * senders are phone numbers, not "XX-BANK" headers), and non-payments are filtered first.
 */
export function parseSms(sender: string, body: string, receivedAt: Date): (NormalizedTxn & { template: string }) | null {
  const templates = smsTemplates.filter((t) => t.sender.test(sender));
  if (templates.length === 0 || isNotAPayment(body)) return null;
  for (const template of templates) {
    const txn = template.match(body, receivedAt);
    if (txn) return { ...txn, template: template.id };
  }
  return null;
}
