import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { bankSenderPatterns, isBankSender, parseSms, smsAmount, smsTemplates } from './index';
import { sha256Hex, smsMessageKey } from './message-key';

interface FixtureCase {
  name: string;
  /** "real" for anonymized messages from a phone (fixtures/sms/real.json); synthetic otherwise. */
  origin?: 'real';
  /** Real drafts are tested only once a person has checked them. */
  reviewed?: boolean;
  sender: string;
  receivedAt: string;
  body: string;
  expected: Record<string, unknown> | null;
}

const read = (file: string): FixtureCase[] => {
  const path = join(__dirname, '../../fixtures/sms', file);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as { cases: FixtureCase[] }).cases : [];
};
const drafts = read('real.json');
const cases = [...read('messages.json'), ...drafts.filter((c) => c.reviewed === true)];

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
    for (const bank of ['hdfc', 'sbi', 'icici', 'axis']) {
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

describe('committed SMS', () => {
  /** Bank helplines and "SMS BLOCK" numbers printed in every alert: public, not personal. */
  const BANK_NUMBERS = new Set(['7308080808', '919951860002', '9951860002', '9215676766']);

  it('carry no personal phone numbers, emails or full account numbers', () => {
    // Unreviewed drafts too: they are committed files as soon as they exist.
    for (const c of [...cases, ...drafts]) {
      const phones = (c.body.match(/(?<!\d)(?:91)?[6-9]\d{9}(?!\d)/g) ?? []).filter((n) => !BANK_NUMBERS.has(n));
      expect({ name: c.name, phones }).toEqual({ name: c.name, phones: [] });
      expect({ name: c.name, longNumber: /\d{13,}/.test(c.body) }).toEqual({ name: c.name, longNumber: false });
      expect({ name: c.name, email: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(c.body) }).toEqual({ name: c.name, email: false });
    }
  });
});

describe('bankSenderPatterns', () => {
  it('lists every template, in syntax Kotlin reads the same way', () => {
    const patterns = bankSenderPatterns();
    expect(patterns).toHaveLength(smsTemplates.length);
    for (const [i, source] of patterns.entries()) {
      // Anchors, classes, groups, alternation and counts only: no lookbehind, named groups or flags but "i".
      expect(source).toMatch(/^\^[A-Za-z0-9[\]{}()|,\\-]+$/);
      expect(smsTemplates[i]!.sender.flags).toBe('i');
    }
  });

  it('accepts each bank and nothing personal', () => {
    const accepts = (sender: string) => bankSenderPatterns().some((p) => new RegExp(p, 'i').test(sender));
    for (const s of ['VM-HDFCBK', 'AD-SBIINB', 'JD-ATMSBI', 'VM-ICICIB', 'AX-AXISBK']) expect(accepts(s)).toBe(true);
    for (const s of ['+919876543210', 'VM-AMAZON', 'AD-SWIGGY', 'Mom']) expect(accepts(s)).toBe(false);
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
    const body = 'Sent Rs.486.00 From HDFC Bank A/C *1234 To SWIGGY On 18/10/26 Ref 427512345601 Not You? Call 18002586161';
    const txn = parseSms('VM-HDFCBK', body, at)!;
    const a = smsMessageKey('VM-HDFCBK', at, txn);
    expect(smsMessageKey('vm-hdfcbk ', new Date('2026-10-18T07:42:10.900Z'), txn)).toBe(a);
    expect(smsMessageKey('VM-HDFCBK', new Date('2026-10-18T07:42:11Z'), txn)).not.toBe(a);
    expect(smsMessageKey('VM-HDFCBK', at, { ...txn, amountPaise: txn.amountPaise + 1 } as typeof txn)).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('depends only on the parsed fields, never on the rest of the body', () => {
    // Same payment, different "Avl Bal": the key must not change, so it can't encode the balance.
    const at = new Date('2026-10-18T07:42:10Z');
    const base = 'Sent Rs.486.00 From HDFC Bank A/C *1234 To SWIGGY On 18/10/26 Ref 427512345601 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808';
    const one = parseSms('VM-HDFCBK', `${base} Avl Bal Rs.12,000.00`, at);
    const two = parseSms('VM-HDFCBK', `${base} Avl Bal Rs.99,999.00`, at);
    expect(one).not.toBeNull();
    expect(two).not.toBeNull();
    expect(smsMessageKey('VM-HDFCBK', at, one!)).toBe(smsMessageKey('VM-HDFCBK', at, two!));
  });
});
