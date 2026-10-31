import { normalizeAccountHint } from './account-hint';

describe('normalizeAccountHint', () => {
  it('keeps the last 4 digits of a masked number', () => {
    expect(normalizeAccountHint({ bank: ' HDFC  Bank ', last4: 'XX1234' })).toEqual({ bankName: 'HDFC Bank', last4: '1234', suffix3: null, kind: 'savings' });
    expect(normalizeAccountHint({ bank: 'SBI', last4: '50100012345678' })?.last4).toBe('5678');
  });

  it('keeps exactly 3 digits as a suffix to match, and the kind the source names', () => {
    expect(normalizeAccountHint({ bank: 'ICICI Bank', last4: 'XX234', kind: 'credit_card' })).toEqual({
      bankName: 'ICICI Bank',
      last4: null,
      suffix3: '234',
      kind: 'credit_card',
    });
  });

  it('drops fewer than 3 digits and needs a bank name', () => {
    expect(normalizeAccountHint({ bank: 'Axis Bank', last4: '12' })).toMatchObject({ last4: null, suffix3: null });
    expect(normalizeAccountHint({ last4: '1234' })).toBeNull();
  });
});
