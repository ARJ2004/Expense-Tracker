import type { NormalizedTxn } from '@et/domain';
import type { SmsTemplate } from '../template';
import { AMOUNT, lastDigits, payee, reference, smsAmount, smsDay, smsTxn } from '../helpers';

const BANK = 'SBI';

/**
 * State Bank of India alerts (senders like "VM-SBIUPI", "AD-SBIINB", "JD-ATMSBI", "VK-SBICRD"):
 *   Dear UPI user A/C X1234 debited by 486.0 on date 18Oct26 trf to SWIGGY Refno 427512345601. If not u? …
 *   Dear SBI User, your A/c X1234-credited by Rs.75000 on 01Oct26 transfer from ACME CORP Ref No 412345678901 -SBI
 *   Your A/C XXXXX1234 Debited INR 2,000.00 on 03/10/26 -Transferred to RAVI KUMAR. Avl Balance …
 *   Dear Customer, transaction number 1234 for Rs.2000.00 by SBI Debit Card X5678 done at S1ANBG12 on 03Oct26 …
 *   Rs.1,299.00 spent on your SBI Credit Card ending 5678 at AMAZON on 12/10/26. …
 * SBI's UPI amounts omit "Rs." ("debited by 486.0"), so those patterns take a bare number.
 */
export class SbiSmsTemplate implements SmsTemplate {
  readonly id = 'sbi';
  readonly sender = /^[A-Z]{2}-(SBI|ATMSBI|SBICRD|CBSSBI)/i;

  match(body: string, receivedAt: Date): NormalizedTxn | null {
    const text = body.replace(/\s+/g, ' ');
    const money = String.raw`((?:Rs\.?|INR)?\s*[\d,]+(?:\.\d{1,2})?)`;
    let m = new RegExp(String.raw`A\/C X*(\d{3,4}) debited by ${money} on date (\S+) trf to (.+?) Ref ?no (\w+)`, 'i').exec(text);
    if (m) return this.txn(m[2], 'debit', receivedAt, { last4: m[1], day: m[3], counterparty: payee(m[4]), ref: m[5], narration: 'UPI' });

    m = new RegExp(String.raw`A\/c X*(\d{3,4})-?\s*credited by ${money} on (?:date )?(\S+?) (?:transfer )?from (.+?) Ref No\.? (\w+)`, 'i').exec(text);
    if (m) {
      return this.txn(m[2], 'credit', receivedAt, { last4: m[1], day: m[3], counterparty: payee(m[4]), ref: m[5], narration: /refund/i.test(text) ? 'REFUND' : 'CREDIT' });
    }

    m = new RegExp(String.raw`A\/C X*(\d{3,4}) (Debited|Credited) (${AMOUNT}) on (\S+?) -?(?:Transferred to|Transferred from|by|from|to) ([^.]+?)\.`, 'i').exec(text);
    if (m) {
      const direction = m[2]!.toLowerCase() === 'debited' ? 'debit' : 'credit';
      return this.txn(m[3], direction, receivedAt, { last4: m[1], day: m[4], counterparty: payee(m[5]), narration: direction === 'debit' ? 'TRANSFER' : 'CREDIT' });
    }

    m = new RegExp(String.raw`for (${AMOUNT}) by SBI Debit Card X*(\d{3,4}) (?:done )?at (\S+) on (\S+?)(?:\.| |$)`, 'i').exec(text);
    if (m) {
      const atm = /\bATM\b|withdraw/i.test(text) || /^S1|^SPC/i.test(m[3]!);
      // A debit card's number isn't the account's: leave the account unknown so the statement row,
      // which names the account, can still merge with this payment (rule 3).
      return this.txn(m[1], 'debit', receivedAt, {
        day: m[4],
        counterparty: atm ? 'ATM withdrawal' : payee(m[3]),
        narration: atm ? 'ATM WITHDRAWAL' : 'CARD',
      });
    }

    m = new RegExp(String.raw`^(${AMOUNT}) spent on your SBI Credit Card ending (\d{3,4}) at (.+?) on (\S+?)\.(?: |$)`, 'i').exec(text);
    if (m) return this.txn(m[1], 'debit', receivedAt, { last4: m[2], day: m[4], counterparty: payee(m[3]), narration: 'CARD', kind: 'credit_card' });

    return null;
  }

  private txn(
    amount: string | undefined,
    direction: 'debit' | 'credit',
    receivedAt: Date,
    f: { last4?: string; counterparty?: string; day?: string; ref?: string; narration: string; kind?: 'credit_card' },
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
