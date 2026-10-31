import { normalizeAccountHint } from './account-hint';

describe('normalizeAccountHint', () => {
  it('keeps the last 4 digits of a masked number', () => {
    expect(normalizeAccountHint({ bank: ' HDFC  Bank ', last4: 'XX1234' })).toEqual({ bankName: 'HDFC Bank', last4: '1234', kind: 'savings' });
    expect(normalizeAccountHint({ bank: 'SBI', last4: '50100012345678' })?.last4).toBe('5678');
  });

  it('drops fewer than 4 digits and needs a bank name', () => {
    expect(normalizeAccountHint({ bank: 'Axis Bank', last4: '12' })?.last4).toBeNull();
    expect(normalizeAccountHint({ last4: '1234' })).toBeNull();
  });
});
