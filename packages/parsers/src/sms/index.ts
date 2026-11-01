import type { NormalizedTxn } from '@et/domain';
import { readTransactionSms } from './generic';
import { isNotAPayment } from './helpers';
import { BANK_HEADERS, parseSender, TRANSACTION_SENDER } from './sender';
import type { SmsTemplate } from './template';
import { AxisSmsTemplate } from './templates/axis.sms';
import { HdfcSmsTemplate } from './templates/hdfc.sms';
import { IciciSmsTemplate } from './templates/icici.sms';
import { SbiSmsTemplate } from './templates/sbi.sms';

export type { SmsTemplate } from './template';
export { AxisSmsTemplate, HdfcSmsTemplate, IciciSmsTemplate, SbiSmsTemplate };
export { isNotAPayment, smsAmount } from './helpers';
export { readTransactionSms } from './generic';
export { BANK_HEADERS, isTransactionSender, parseSender, TRANSACTION_SENDER, type SenderCategory, type SmsSender } from './sender';

/**
 * Exact readers for banks whose formats we know. Optional: any other bank is read by its wording
 * (readTransactionSms); a template is added only for a format that reader gets wrong.
 */
export const smsTemplates: readonly SmsTemplate[] = [new HdfcSmsTemplate(), new SbiSmsTemplate(), new IciciSmsTemplate(), new AxisSmsTemplate()];

/**
 * The inbox filter for the Android module: business senders that aren't promotional. Personal
 * messages and "-P" promotions never leave the phone's SMS store. Kotlin and JavaScript read it alike.
 */
export function transactionSenderPatterns(): string[] {
  return [TRANSACTION_SENDER.source];
}

/**
 * A sender whose transactions are added without asking: one a bank template claims, or a bank
 * header we know by name. Any other business sender is confirmed by the person once.
 */
export function isKnownBankSender(sender: string): boolean {
  const from = parseSender(sender);
  return from !== null && from.category !== 'P' && (smsTemplates.some((t) => t.sender.test(sender)) || from.code in BANK_HEADERS);
}

/**
 * The transaction in one SMS, or null. Personal messages (phone numbers) and promotional senders
 * are never read, and non-payments are filtered first. A bank's own template reads its formats
 * exactly; any other message is read by its wording (readTransactionSms).
 */
export function parseSms(sender: string, body: string, receivedAt: Date): (NormalizedTxn & { template: string }) | null {
  const from = parseSender(sender);
  if (!from || from.category === 'P' || isNotAPayment(body)) return null;
  for (const template of smsTemplates.filter((t) => t.sender.test(sender))) {
    const txn = template.match(body, receivedAt);
    if (txn) return { ...txn, template: template.id };
  }
  const txn = readTransactionSms(body, receivedAt, bankName(from.code, body));
  return txn ? { ...txn, template: 'generic' } : null;
}

/** The bank's name: from its header, else as the message names it ("SVC Bank A/c"), else the header. */
export function bankName(code: string, body: string): string {
  const known = BANK_HEADERS[code.toUpperCase()];
  if (known) return known;
  const named = /\b((?:[A-Z][A-Za-z&-]*\.? ){0,3}Bank)\b/.exec(body)?.[1];
  if (named && !/^(your|dear|the|our|my|from|to|by|in|of) /i.test(named) && named !== 'Bank') return named;
  return code.toUpperCase();
}
