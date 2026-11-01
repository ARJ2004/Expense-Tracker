import { isBankSender, isNotAPayment, parseSms } from '../index';

/**
 * Dev-only: turns bank SMS exported from a real phone into draft test cases with the personal
 * parts replaced, so the parser can be tested on real formats without committing anyone's data.
 * Not exported from the package index, so it never reaches the app bundle.
 *
 * Replaced consistently within one run (the same original always gets the same stand-in, so an
 * SMS and its duplicate still match): account and card digits, reference and other long numbers,
 * personal phone numbers, VPAs, emails, balances and limits, links, greeting names and payee
 * names that look like a person's. Amounts, dates, wording and bank helplines stay as they are.
 */

export interface RawSms {
  sender: string;
  body: string;
  /** Epoch milliseconds. */
  date: number;
}

export interface DraftCase {
  name: string;
  origin: 'real';
  /** False until a person has checked the body is anonymous and `expected` is right. */
  reviewed: false;
  sender: string;
  receivedAt: string;
  body: string;
  expected: Record<string, unknown> | null;
  /** Why this one needs a closer look. */
  note?: string;
}

/** Toll-free and "SMS BLOCK" numbers banks print in every alert: public, kept as they are. */
const PUBLIC_NUMBER = /^(?:1800|1860|(?:91)?(?:7308080808|9951860002|9215676766)$)/;
/** Words that mark a business, not a person, in a payee name. */
const BUSINESS = /\b(LTD|LIMITED|PVT|PRIVATE|INDIA|STORE|STORES|MART|BANK|SERVICES?|TECHNOLOG\w*|RETAIL|FOODS?|ENTERPRISES?|CORP\w*|INC|LLP|PAY|ONLINE|PAYMENTS?|INSURANCE|ELECTRICITY|BESCOM|AIRTEL|JIO|AMAZON|FLIPKART|SWIGGY|ZOMATO|UBER|OLA)\b/i;

/** A run's stand-ins: the same input always maps to the same output. */
class Aliases {
  private readonly seen = new Map<string, string>();
  private n = 0;
  constructor(private readonly make: (n: number, original: string) => string) {}
  of(original: string): string {
    const key = original.toUpperCase();
    let alias = this.seen.get(key);
    if (!alias) {
      alias = this.make(++this.n, original);
      this.seen.set(key, alias);
    }
    return alias;
  }
}

/** Digits of the same length, never starting with 0, derived from a counter (not the original). */
function fakeDigits(n: number, length: number, seed: number): string {
  let out = '';
  let x = (n * 7919 + seed) >>> 0;
  while (out.length < length) {
    x = (x * 1103515245 + 12345) >>> 0;
    out += String((x >>> 16) % 10);
  }
  return (out[0] === '0' ? '7' : out[0]) + out.slice(1);
}

export function anonymize(messages: readonly RawSms[]): DraftCase[] {
  const digits = new Aliases((n, o) => fakeDigits(n, o.length, 17));
  const longNumbers = new Aliases((n, o) => fakeDigits(n, o.length, 41));
  const vpas = new Aliases((n) => `payee${n}`);
  const people = new Aliases((n) => `PERSON ${String.fromCharCode(64 + ((n - 1) % 26) + 1)}`);

  const drafts: DraftCase[] = [];
  for (const m of messages) {
    if (!isBankSender(m.sender)) continue;
    const receivedAt = new Date(m.date);
    let body = m.body;

    // Emails and links first, so their digits and @ aren't read as anything else.
    body = body.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}(\.[a-z]{2,})?/gi, 'user@example.com');
    body = body.replace(/\b((?:https?:\/\/)?[a-z0-9-]+\.(?:io|in|com|co|me|ly)\/)\S+/gi, '$1x');
    // VPAs: keep the bank handle (it says which app), replace the person's part.
    body = body.replace(/\b([\w.-]+)@([a-z][a-z0-9]*)\b/gi, (_all, local: string, handle: string) => `${vpas.of(local)}@${handle}`);
    // Balances and limits: their value says nothing the test needs.
    body = body.replace(/\b(Avl\.? ?(?:Bal(?:ance)?|Lmt|Limit)|Available (?:Balance|Limit)|Bal)(\s*(?:is|:)?\s*(?:INR|Rs\.?)?\s*)[\d,]+(?:\.\d{1,2})?/gi, '$1$210,000.00');
    // Masked account and card digits: "XX1234", "*1234", "Card 5678", "ending 5678".
    body = body.replace(/([X*x]{1,}|\b(?:Card(?: no\.?)?|ending|A\/c no\.?)\s+[X*x]*)(\d{3,4})\b/g, (_all, prefix: string, d: string) => prefix + digits.of(d));
    // Long numbers: references, account and personal phone numbers. Public helplines stay.
    body = body.replace(/(?<![\d.,])\d{9,}(?![\d.,]\d)/g, (n) => (PUBLIC_NUMBER.test(n) ? n : longNumbers.of(n)));
    // "Dear RAVI KUMAR," greetings.
    body = body.replace(/\b(Dear)\s+(?!Customer|User|UPI|SBI|Sir|Madam|Cardholder|Card ?member)[A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*){0,3}(?=[,!:])/g, '$1 Customer');

    // A payee that looks like a person (no business word) is replaced wherever it appears.
    const before = parseSms(m.sender, body, receivedAt);
    const payee = before?.counterparty;
    if (payee && !BUSINESS.test(payee) && /^[A-Za-z]+(?: [A-Za-z.]+){1,3}$/.test(payee)) {
      body = body.replace(new RegExp(escapeRegExp(payee), 'gi'), people.of(payee));
    }

    const txn = parseSms(m.sender, body, receivedAt);
    const recognised = txn !== null || isNotAPayment(body);
    drafts.push({
      name: `real ${txn ? `${txn.template} ${txn.direction}` : 'ignored'} ${drafts.length + 1}`,
      origin: 'real',
      reviewed: false,
      sender: m.sender,
      receivedAt: receivedAt.toISOString(),
      body,
      expected: txn
        ? {
            template: txn.template,
            amountPaise: txn.amountPaise,
            direction: txn.direction,
            occurredAt: txn.occurredAt.toISOString(),
            timePrecision: txn.timePrecision,
            accountHint: txn.accountHint,
            ...(txn.counterparty ? { counterparty: txn.counterparty } : {}),
            ...(txn.referenceNo ? { referenceNo: txn.referenceNo } : {}),
            ...(txn.narration ? { narration: txn.narration } : {}),
          }
        : null,
      ...(recognised ? {} : { note: 'Not recognised: if this is a payment, fill in expected and fix the template' }),
    });
  }
  return drafts;
}

/**
 * The `adb shell content query --uri content://sms/inbox --projection address:body:date` output:
 * "Row: 0 address=VM-HDFCBK, body=…, date=1793…", a body running over several lines.
 */
export function parseAdbExport(text: string): RawSms[] {
  const rows = text.split(/\r?\n(?=Row: \d+ )/);
  const out: RawSms[] = [];
  for (const row of rows) {
    const m = /^Row: \d+ address=(.*?), body=([\s\S]*), date=(\d+)\s*$/.exec(row.trim());
    if (m) out.push({ sender: m[1]!, body: m[2]!, date: Number(m[3]) });
  }
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
