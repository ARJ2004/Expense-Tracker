import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isBankSender, parseSms, smsAmount } from './index';
import { sha256Hex, smsMessageKey } from './message-key';

interface FixtureCase {
  name: string;
  sender: string;
  receivedAt: string;
  body: string;
  expected: Record<string, unknown> | null;
}

const { cases } = JSON.parse(readFileSync(join(__dirname, '../../fixtures/sms/messages.json'), 'utf8')) as { cases: FixtureCase[] };

describe('SMS fixtures', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const txn = parseSms(c.sender, c.body, new Date(c.receivedAt));
    if (c.expected === null) {
      expect(txn).toBeNull();
      return;
    }
    expect(txn).not.toBeNull();
    const { occurredAt, ...rest } = c.expected;
    expect({ ...txn!, occurredAt: txn!.occurredAt.toISOString() }).toMatchObject({ source: 'sms', ...rest, ...(occurredAt ? { occurredAt } : {}) });
  });

  it('never keeps the message text on the parsed transaction', () => {
    for (const c of cases) {
      const txn = parseSms(c.sender, c.body, new Date(c.receivedAt));
      expect(txn?.rawText).toBeUndefined();
      if (txn?.narration) expect(c.body).not.toBe(txn.narration);
    }
  });

  it('never sends a debit card number as an account number', () => {
    const debitCards = cases.filter((c) => /debit card/i.test(c.body) && c.expected !== null);
    expect(debitCards.length).toBeGreaterThanOrEqual(3);
    for (const c of debitCards) {
      expect(parseSms(c.sender, c.body, new Date(c.receivedAt))?.accountHint?.last4).toBeUndefined();
    }
  });

  it('covers debit, credit and ignored messages for every bank', () => {
    for (const bank of ['hdfc', 'sbi', 'icici']) {
      const parsed = cases.map((c) => parseSms(c.sender, c.body, new Date(c.receivedAt))).filter((t) => t?.template === bank);
      expect(parsed.some((t) => t!.direction === 'debit')).toBe(true);
      expect(parsed.some((t) => t!.direction === 'credit')).toBe(true);
    }
    expect(cases.filter((c) => c.expected === null).length).toBeGreaterThanOrEqual(6);
  });
});

describe('smsAmount', () => {
  it.each([
    ['Rs.486.00', 48_600],
    ['INR 1,23,456.5', 12_345_650],
    ['Rs 2000', 200_000],
    ['486.0', 48_600],
    ['₹0.05', 5],
  ])('%s → %d paise', (raw, expected) => {
    expect(smsAmount(raw)).toBe(expected);
  });

  it.each([['Rs.0.00'], ['Rs.'], ['12.345'], ['1e3'], ['']])('rejects %p', (raw) => {
    expect(smsAmount(raw)).toBeNull();
  });
});

describe('isBankSender', () => {
  it('accepts bank headers and rejects phone numbers', () => {
    expect(isBankSender('VM-HDFCBK')).toBe(true);
    expect(isBankSender('JD-ATMSBI')).toBe(true);
    expect(isBankSender('AX-ICICIT')).toBe(true);
    expect(isBankSender('+919876543210')).toBe(false);
    expect(isBankSender('VM-AMAZON')).toBe(false);
  });
});

describe('message key', () => {
  it('matches Node SHA-256 on ASCII, Unicode and multi-block input', () => {
    for (const text of ['', 'abc', 'Rs.486 ₹ नमस्ते 😀', 'x'.repeat(200)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });

  it('is stable for the same message and differs for another', () => {
    const at = new Date('2026-10-18T07:42:10.400Z');
    const a = smsMessageKey('VM-HDFCBK', at, 'Sent Rs.486.00  From HDFC');
    expect(smsMessageKey('vm-hdfcbk ', new Date('2026-10-18T07:42:10.900Z'), 'Sent Rs.486.00 From HDFC')).toBe(a);
    expect(smsMessageKey('VM-HDFCBK', new Date('2026-10-18T07:42:11Z'), 'Sent Rs.486.00 From HDFC')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
