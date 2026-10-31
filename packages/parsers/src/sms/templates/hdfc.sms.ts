import type { NormalizedTxn } from '@et/domain';
import type { SmsTemplate } from '../template';
import { AMOUNT, lastDigits, payee, reference, smsAmount, smsDay, smsTxn } from '../helpers';

const BANK = 'HDFC Bank';

/**
 * HDFC Bank alerts (senders like "VM-HDFCBK", "AD-HDFCBK-S"):
 *   Sent Rs.486.00 From HDFC Bank A/C *1234 To SWIGGY On 18/10/26 Ref 427512345601 Not You? …
 *   Rs.1842.00 debited from a/c **1234 on 18-10-26 to VPA bescom@hdfcbank(UPI Ref No 429112345683).
 *   Credit Alert! Rs.75,000.00 credited to HDFC Bank A/c XX1234 on 01-10-26 from VPA acme@icici (UPI 412345678901)
 *   Rs.2000.00 withdrawn at ATM S1ANBG12 from A/c XX1234 on 03-10-26. Avl bal: …
 *   Spent Rs.1,299.00 On HDFC Bank Card 5678 At AMAZON PAY INDIA On 2026-10-12:14:05:11 …
 *   Txn Rs.640.00 On HDFC Bank Card 5678 At PVR INOX by UPI 430112345690 On 28-10 …
 */
export class HdfcSmsTemplate implements SmsTemplate {
  readonly id = 'hdfc';
  readonly sender = /^[A-Z]{2}-HDFCB[KN]/i;

  match(body: string, receivedAt: Date): NormalizedTxn | null {
    const text = body.replace(/\s+/g, ' ');
    let m = new RegExp(String.raw`^Sent (${AMOUNT}) From HDFC Bank A\/C [*X]*(\d{3,4}) To (.+?) On (\S+?)(?: Ref (\w+))?(?: Not You|\.|$)`, 'i').exec(text);
    if (m) {
      return this.txn(m[1], 'debit', receivedAt, { last4: m[2], counterparty: payee(m[3]), day: m[4], ref: m[5], narration: 'UPI' });
    }
    m = new RegExp(String.raw`^(${AMOUNT}) debited from a\/c [*X]*(\d{3,4}) on (\S+) to (?:VPA )?([^\s(]+)(?:\s*\(UPI Ref No\.? (\w+)\))?`, 'i').exec(text);
    if (m) {
      return this.txn(m[1], 'debit', receivedAt, { last4: m[2], day: m[3], counterparty: payee(m[4]), ref: m[5], narration: 'UPI' });
    }
    m = new RegExp(String.raw`(${AMOUNT}) credited to HDFC Bank A\/c [*X]*(\d{3,4}) on (\S+)(?: from (?:VPA )?([^\s(]+))?(?:\s*\((?:UPI|UPI Ref No\.?) (\w+)\))?`, 'i').exec(text);
    if (m) {
      return this.txn(m[1], 'credit', receivedAt, { last4: m[2], day: m[3], counterparty: payee(m[4]), ref: m[5], narration: /refund/i.test(text) ? 'REFUND' : 'CREDIT' });
    }
    m = new RegExp(String.raw`^(${AMOUNT}) withdrawn at ATM \S+ from A\/c [*X]*(\d{3,4}) on (\S+?)\.?(?: |$)`, 'i').exec(text);
    if (m) {
      return this.txn(m[1], 'debit', receivedAt, { last4: m[2], day: m[3], counterparty: 'ATM withdrawal', narration: 'ATM WITHDRAWAL' });
    }
    m = new RegExp(String.raw`^(?:Spent|Txn) (${AMOUNT}) On HDFC Bank (Credit |Debit )?Card [*X]*(\d{3,4}) At (.+?)(?: by UPI (\w+))? On (\S+?)(?:\.| |$)`, 'i').exec(text);
    if (m) {
      const day = m[6]!.slice(0, 10).replace(/:$/, '');
      return this.txn(m[1], 'debit', receivedAt, {
        // A debit card's number isn't the account's: the account stays unknown (see smsTxn).
        ...(m[2]?.toLowerCase().startsWith('debit') ? {} : { last4: m[3] }),
        counterparty: payee(m[4]),
        ref: m[5],
        day,
        narration: 'CARD',
        kind: m[2]?.toLowerCase().startsWith('debit') ? 'savings' : 'credit_card',
      });
    }
    return null;
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
      referenceNo: reference(f.ref),
      narration: f.narration,
    });
  }
}
