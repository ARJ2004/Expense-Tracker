import { parseSms } from './index';

const AT = new Date('2026-11-01T09:12:40Z');
const read = (sender: string, body: string) => parseSms(sender, body, AT);

describe('any bank, read by its wording', () => {
  it.each([
    [
      'Kotak UPI credit from a UPI ID',
      'BP-KOTAKB-S',
      'Received Rs.500.00 in your Kotak Bank A/c X1234 from ravi.kumar@okaxis on 01-11-26. UPI Ref 427512345702.',
      { amountPaise: 50_000, direction: 'credit', accountHint: { bank: 'Kotak Mahindra Bank', last4: '1234' }, counterparty: 'Ravi Kumar', referenceNo: '427512345702' },
    ],
    [
      'Bank of Baroda debit with the balance first',
      'VM-BOBTXN',
      'Avl Bal Rs.12,000.00. Rs.750.00 debited from A/c ...1234 on 01-11-26 to BESCOM. UPI Ref No 427512345703 -Bank of Baroda',
      { amountPaise: 75_000, direction: 'debit', accountHint: { bank: 'Bank of Baroda', last4: '1234' }, counterparty: 'Bescom' },
    ],
    [
      'PNB NEFT credit',
      'AD-PNBSMS-T',
      'Your A/c XX1234 is credited with INR 45,000.00 on 01-11-2026 by NEFT/PUNBN12345678/ACME SOFTWARE. Avl Bal INR 60,120.00',
      { amountPaise: 4_500_000, direction: 'credit', accountHint: { bank: 'Punjab National Bank', last4: '1234' }, counterparty: 'Acme Software', narration: 'CREDIT' },
    ],
    [
      'Canara ATM withdrawal',
      'JK-CANBNK',
      'INR 2,000.00 withdrawn at ATM from A/c no. XX1234 on 01Nov26. Avl bal INR 8,000.00 -Canara Bank',
      { amountPaise: 200_000, direction: 'debit', counterparty: 'ATM withdrawal', narration: 'ATM WITHDRAWAL' },
    ],
    [
      'IDFC credit card spend',
      'VM-IDFCFB',
      'Rs.1,299.00 spent on your IDFC FIRST Bank Credit Card ending 5678 at AMAZON on 01-11-26. Avl limit Rs.48,701.00',
      { amountPaise: 129_900, direction: 'debit', accountHint: { bank: 'IDFC FIRST Bank', last4: '5678', kind: 'credit_card' }, counterparty: 'Amazon', narration: 'CARD' },
    ],
    [
      'a bank we have never heard of',
      'VM-NEWBNK',
      'Dear Customer, your a/c XX1234 has been debited by Rs.320.00 on 01-11-26 towards UPI/427512345704/TEA STALL. -New Co-op Bank',
      { amountPaise: 32_000, direction: 'debit', accountHint: { bank: 'New Co-op Bank', last4: '1234' }, referenceNo: '427512345704' },
    ],
    [
      'refund',
      'VM-YESBNK',
      'Refund of Rs.249.00 credited to your Yes Bank A/c XX1234 from FLIPKART on 01-11-26.',
      { amountPaise: 24_900, direction: 'credit', narration: 'REFUND' },
    ],
  ])('%s', (_name, sender, body, expected) => {
    expect(read(sender, body)).toMatchObject({ source: 'sms', template: 'generic', ...expected });
  });

  it('reads SVC Bank, which has no template', () => {
    const body = 'SVC Bank A/c *1234 DEBITED for Rs.11.00 Clr Bal Rs.1,89,764.50. CR UPI/DR/427512345701/KALLAHALL/. Not You? SMS STOPUPI to 9820620454';
    expect(read('VH-SVCBNK', body)).toEqual({
      source: 'sms',
      template: 'generic',
      amountPaise: 1100,
      direction: 'debit',
      occurredAt: AT,
      timePrecision: 'minute',
      accountHint: { bank: 'SVC Bank', last4: '1234' },
      counterparty: 'Kallahall',
      referenceNo: '427512345701',
      narration: 'UPI',
    });
  });

  it('never keeps the balance as the amount', () => {
    const txn = read('VH-SVCBNK', 'SVC Bank A/c *1234 DEBITED for Rs.11.00 Clr Bal Rs.1,89,764.50. Not You? Call 18003132120');
    expect(txn?.amountPaise).toBe(1100);
  });

  it("doesn't send a debit card's digits as the account", () => {
    const txn = read('VM-KOTAKB', 'Rs.640.00 spent on Kotak Bank Debit Card XX5678 at PVR INOX on 01-11-26.');
    expect(txn).toMatchObject({ amountPaise: 64_000, direction: 'debit', narration: 'CARD' });
    expect(txn?.accountHint?.last4).toBeUndefined();
  });
});

describe('promotions, scams and other messages that are not transactions', () => {
  it.each([
    ['promotion from a -P sender', 'VM-LOANAP-P', 'Rs.5,000 credited to your account XX1234! Claim now'],
    ['fake credit with a link', 'VM-REWARD', 'Congratulations! Rs.5,000 credited to your a/c XX1234. Claim at http://bit.ly/abc'],
    ['fake credit with no link', 'AD-CASHAP', 'Rs.10,000 has been credited to your wallet. Reward ID 9988776655. Claim before midnight.'],
    ['pre-approved loan', 'VM-FINAPP', 'Your pre-approved loan of Rs.2,00,000 is ready to be credited to A/c XX1234. Apply now.'],
    ['will be credited', 'VM-KOTAKB', 'Rs.500 will be credited to your A/c XX1234 within 2 days.'],
    ['get Rs.', 'VM-SHOPCO', 'Get Rs.200 credited on your first order. Use code NEW200.'],
    ['a personal message', '+919876543210', 'I have sent Rs.500 to your account XX1234, ref 427512345799'],
    ['a credit card bill paid', 'VM-IDFCFB', 'Payment of Rs.12,430.00 received towards your IDFC FIRST Bank Credit Card XX5678. Thank you.'],
    ['an OTP', 'VM-NEWBNK', '482913 is your OTP to debit Rs.500 from A/c XX1234. Do not share.'],
    ['a balance alert', 'VM-NEWBNK', 'Your A/c XX1234 balance is Rs.12,000.00 as on 01-11-26.'],
    ['a debit with no account or reference', 'VM-SHOPCO', 'Rs.499 debited for your order. Thanks for shopping!'],
    ['a failed payment', 'VM-NEWBNK', 'Txn of Rs.500 from A/c XX1234 failed. Amount will be refunded.'],
  ])('%s', (_name, sender, body) => {
    expect(read(sender, body)).toBeNull();
  });
});
