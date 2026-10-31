import type { NormalizedTxn } from '@et/domain';
import type { SmsTemplate } from '../template';
import { AMOUNT, lastDigits, payee, reference, smsAmount, smsDay, smsTxn } from '../helpers';

const BANK = 'ICICI Bank';

/**
 * ICICI Bank alerts (senders like "VM-ICICIB", "AX-ICICIT"):
 *   ICICI Bank Acct XX234 debited for Rs 486.00 on 18-Oct-26; SWIGGY credited. UPI:427512345601. Call 18002662 for dispute. …
 *   Dear Customer, Acct XX234 is credited with Rs 75,000.00 on 01-Oct-26 from ACME CORP. UPI:412345678901-ICICI Bank.
 *   INR 1,299.00 spent using ICICI Bank Card XX5678 on 12-Oct-26 on AMAZON PAY. Avl Limit: …
 *   ICICI Bank Acct XX234 debited with INR 2,000.00 on 03-Oct-26 at ATM S1ANBG12. …
 * ICICI masks savings accounts to the last 3 digits ("XX234"); accounts match on that suffix.
 */
export class IciciSmsTemplate implements SmsTemplate {
  readonly id = 'icici';
  readonly sender = /^[A-Z]{2}-ICICI[BT]/i;

  match(body: string, receivedAt: Date): NormalizedTxn | null {
    const text = body.replace(/\s+/g, ' ');
    let m = new RegExp(String.raw`Acct X*(\d{3,4}) debited (?:for|with) (${AMOUNT}) on (\S+?) (?:at )?ATM\b`, 'i').exec(text);
    if (m) return this.txn(m[2], 'debit', receivedAt, { last4: m[1], day: m[3], counterparty: 'ATM withdrawal', narration: 'ATM WITHDRAWAL' });

    m = new RegExp(String.raw`Acct X*(\d{3,4}) debited (?:for|with) (${AMOUNT}) on (\S+?);\s*(.+?) credited\.(?:\s*UPI:(\w+))?`, 'i').exec(text);
    if (m) return this.txn(m[2], 'debit', receivedAt, { last4: m[1], day: m[3], counterparty: payee(m[4]), ref: m[5], narration: 'UPI' });

    m = new RegExp(String.raw`Acct X*(\d{3,4}) is credited (?:with )?(${AMOUNT}) on (\S+?) (?:from|by) (.+?)\.(?:\s*UPI:(\w+))?`, 'i').exec(text);
    if (m) {
      return this.txn(m[2], 'credit', receivedAt, { last4: m[1], day: m[3], counterparty: payee(m[4]), ref: m[5], narration: /refund/i.test(text) ? 'REFUND' : 'CREDIT' });
    }

    m = new RegExp(String.raw`^(${AMOUNT}) spent (?:using|on) ICICI Bank (Credit |Debit )?Card X*(\d{3,4}) on (\S+?) (?:on|at) (.+?)\.(?: |$)`, 'i').exec(text);
    if (m) {
      return this.txn(m[1], 'debit', receivedAt, {
        // A debit card's number isn't the account's: the account stays unknown (see smsTxn).
        ...(m[2]?.toLowerCase().startsWith('debit') ? {} : { last4: m[3] }),
        day: m[4],
        counterparty: payee(m[5]),
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
