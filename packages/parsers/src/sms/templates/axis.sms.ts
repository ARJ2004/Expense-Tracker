import type { NormalizedTxn } from '@et/domain';
import { parseNarration } from '../../statement/narration';
import type { SmsTemplate } from '../template';
import { lastDigits, payee, smsAmount, smsDay, smsTxn } from '../helpers';

const BANK = 'Axis Bank';
const MONEY = String.raw`((?:INR|Rs\.?)\s*[\d,]+(?:\.\d{1,2})?)`;
/** "18-10-26, 13:12:10" or "18-10-26 13:12:10 IST": the day is what matters. */
const WHEN = String.raw`(\d{2}-\d{2}-\d{2,4}),? \d{2}:\d{2}(?::\d{2})?(?: IST)?`;

/**
 * Axis Bank alerts (senders like "AX-AXISBK", "VM-AXISBK"), one field per line:
 *   INR 486.00 debited / A/c no. XX1234 / 18-10-26, 13:12:10 / UPI/P2M/427512345611/SWIGGY LIMITED / Not you? …
 *   INR 78,000.00 credited / A/c no. XX1234 / 01-10-26, 10:02:11 IST / NEFT/AXISN26274123456/ACME SOFTWARE PVT LTD / - Axis Bank
 *   Debit INR 486.00 / Axis Bank A/c XX1234 / 18-10-26 13:12:10 / UPI/P2M/427512345611/SWIGGY LIMITED / Not you? …
 *   Spent / Card no. XX5678 / INR 1,299.00 / 12-10-26 14:05:11 / AMAZON PAY IN / Avl Lmt INR 48,701.00 / …
 *   INR 640.00 spent on Axis Bank Debit Card no. XX5678 at PVR INOX on 28-10-26. …
 * The detail line is the statement's narration, so it is read by the same parser.
 */
export class AxisSmsTemplate implements SmsTemplate {
  readonly id = 'axis';
  readonly sender = /^[A-Z]{2}-AXISB[KN]/i;

  match(body: string, receivedAt: Date): NormalizedTxn | null {
    const text = body.replace(/\s+/g, ' ').trim();
    let m = new RegExp(String.raw`^${MONEY} (debited|credited) A\/c no\. X*(\d{3,4}) ${WHEN} (.+?)(?: Not you\?| -? ?Axis Bank|$)`, 'i').exec(text);
    if (m) return this.account(m[1], m[2]!, m[3], m[4], m[5]!, text, receivedAt);

    m = new RegExp(String.raw`^(Debit|Credit) ${MONEY} Axis Bank A\/c X*(\d{3,4}) ${WHEN} (.+?)(?: Not you\?| -? ?Axis Bank|$)`, 'i').exec(text);
    if (m) return this.account(m[2], m[1]!.toLowerCase() === 'debit' ? 'debited' : 'credited', m[3], m[4], m[5]!, text, receivedAt);

    m = new RegExp(String.raw`^Spent Card no\. X*(\d{4}) ${MONEY} ${WHEN} (.+?) Avl Lmt`, 'i').exec(text);
    if (m) return this.txn(m[2], 'debit', receivedAt, { last4: m[1], day: m[3], counterparty: payee(m[4]), narration: 'CARD', kind: 'credit_card' });

    // A debit card's number isn't the account's: the account stays unknown (see smsTxn).
    m = new RegExp(String.raw`^${MONEY} spent on Axis Bank Debit Card no\. X*\d{4} at (.+?) on (\d{2}-\d{2}-\d{2,4})`, 'i').exec(text);
    if (m) return this.txn(m[1], 'debit', receivedAt, { day: m[3], counterparty: payee(m[2]), narration: 'CARD', kind: 'savings' });
    return null;
  }

  private account(amount: string | undefined, verb: string, last4: string | undefined, day: string | undefined, details: string, text: string, receivedAt: Date) {
    const parts = parseNarration(details);
    const channel = /^(UPI|NEFT|IMPS|RTGS)\b/i.exec(details)?.[1]?.toUpperCase();
    const credit = verb.toLowerCase() === 'credited';
    const narration =
      parts.counterparty === 'ATM withdrawal' ? 'ATM WITHDRAWAL' : credit ? (/refund/i.test(text) ? 'REFUND' : 'CREDIT') : (channel ?? 'DEBIT');
    return this.txn(amount, credit ? 'credit' : 'debit', receivedAt, { last4, day, counterparty: parts.counterparty, ref: parts.referenceNo, narration });
  }

  private txn(
    amount: string | undefined,
    direction: 'debit' | 'credit',
    receivedAt: Date,
    f: { last4?: string; counterparty?: string; day?: string; ref?: string; narration: string; kind?: 'savings' | 'credit_card' },
  ): NormalizedTxn | null {
    const amountPaise = smsAmount(amount);
    if (!amountPaise) return null;
    return smsTxn({
      bank: BANK,
      amountPaise,
      direction,
      receivedAt,
      bodyDay: smsDay(f.day),
      last4: lastDigits(f.last4),
      ...(f.kind ? { kind: f.kind } : {}),
      counterparty: f.counterparty,
      referenceNo: f.ref,
      narration: f.narration,
    });
  }
}
