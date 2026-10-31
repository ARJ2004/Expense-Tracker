import { capturedToIngest, hintKey, type CapturedTxn } from './captured-txn';
import { sourceHash } from './source-input';

const item: CapturedTxn = {
  source: 'sms',
  messageKey: 'a'.repeat(64),
  amountPaise: 48_600,
  direction: 'debit',
  occurredAt: '2026-10-18T07:42:10Z',
  timePrecision: 'minute',
  bank: 'HDFC Bank',
  last4: '1234',
  counterparty: ' Swiggy ',
  referenceNo: 'abc427512345601',
  narration: 'UPI',
};

describe('capturedToIngest', () => {
  it('builds an sms NormalizedTxn with an account hint and no raw text', () => {
    const { txn, source } = capturedToIngest(item, new Date('2026-10-18T08:00:00Z'));
    expect(txn).toEqual({
      source: 'sms',
      amountPaise: 48_600,
      direction: 'debit',
      occurredAt: new Date('2026-10-18T07:42:10Z'),
      timePrecision: 'minute',
      accountHint: { bank: 'HDFC Bank', last4: '1234' },
      counterparty: 'Swiggy',
      referenceNo: 'ABC427512345601',
      narration: 'UPI',
    });
    expect(source).toEqual({ kind: 'sms', messageKey: 'a'.repeat(64) });
  });

  it('refuses a time more than a day ahead', () => {
    expect(() => capturedToIngest({ ...item, occurredAt: '2026-10-21T00:00:00Z' }, new Date('2026-10-18T08:00:00Z'))).toThrow(RangeError);
  });

  it('hashes by user and message key only', () => {
    const a = sourceHash('u1', { kind: 'sms', messageKey: 'A'.repeat(64) });
    expect(sourceHash('u1', { kind: 'sms', messageKey: 'a'.repeat(64) })).toBe(a);
    expect(sourceHash('u2', { kind: 'sms', messageKey: 'a'.repeat(64) })).not.toBe(a);
  });

  it('keys account lookups by bank, digits and kind', () => {
    expect(hintKey({ bank: ' HDFC Bank', last4: '1234' })).toBe(hintKey({ bank: 'hdfc bank', last4: '1234' }));
    expect(hintKey({ bank: 'HDFC Bank', last4: '5678', kind: 'credit_card' })).not.toBe(hintKey({ bank: 'HDFC Bank', last4: '5678' }));
  });
});
