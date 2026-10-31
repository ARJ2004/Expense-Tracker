import { MAX_AMOUNT_PAISE, paise, type AccountKind, type Direction, type NormalizedTxn } from '@et/domain';
import { parseDate } from '../statement/cells';
import { titleCase } from '../statement/narration';

/**
 * Pieces every bank's SMS template uses. Pure string → value: amounts never go through floats,
 * and nothing here logs or keeps the message text.
 */

/** "Rs.1,234.56", "INR 486", "Rs 2,000" → paise; null for anything else (and for 0). */
export function smsAmount(raw: string | undefined): number | null {
  const m = /^(?:RS\.?|INR|₹)?\s*([\d,]+)(?:\.(\d{1,2}))?$/i.exec((raw ?? '').trim());
  if (!m) return null;
  const whole = m[1]!.replace(/,/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const value = Number(whole) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return value > 0 && value <= MAX_AMOUNT_PAISE ? value : null;
}

/** The amount token in a body: "Rs.486.00", "INR 1,234.50", "Rs 2000". */
export const AMOUNT = String.raw`(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d{1,2})?`;

/** Wording a bank uses only once money has actually moved. */
const COMPLETED = /\b(debited|credited|spent|sent|withdrawn|txn of|transaction number)\b/i;

/**
 * Messages that are never a completed payment: one-time passwords, payment requests, failed or
 * declined attempts, bills and reminders, and offers. Templates run only after this says no.
 *
 * Promotional words count only when nothing says money moved: banks append offers to real
 * alerts ("Rs.486 debited … Get 10% cashback up to Rs.100 on …"), and dropping those would lose
 * real spends.
 */
export function isNotAPayment(body: string): boolean {
  return /\b(OTP|one[- ]time password|verification code|passcode)\b/i.test(body)
    || /\b(has requested|requested money|collect request|is requesting)\b/i.test(body)
    || /\b(declined|failed|unsuccessful|could not be processed|reversal pending)\b/i.test(body)
    || /\b(is due|due on|due date|min(imum)? amount due|overdue|will be debited)\b/i.test(body)
    || (!COMPLETED.test(body) && /\b(offer|cashback up to|pre-?approved|apply now|eligible for|win|won|lucky|scheduled)\b/i.test(body));
}

/** A date written in the body ("18-10-26", "18Oct26", "18-Oct-2026") as "YYYY-MM-DD". */
export function smsDay(raw: string | undefined): string | null {
  const text = (raw ?? '').trim();
  const compact = /^(\d{1,2})([A-Za-z]{3})(\d{2}|\d{4})$/.exec(text);
  return parseDate(compact ? `${compact[1]} ${compact[2]} ${compact[3]}` : text);
}

/**
 * When it happened. The phone's receive time is precise to the minute and usually right; when the
 * body names a different IST day (a delayed or batched SMS), that day wins at 12:00 IST so the
 * time-of-day rules never claim a precision the SMS doesn't have.
 */
export function occurredAt(receivedAt: Date, bodyDay: string | null): { occurredAt: Date; timePrecision: 'minute' | 'day' } {
  if (!bodyDay) return { occurredAt: receivedAt, timePrecision: 'minute' };
  const receivedDay = new Date(receivedAt.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  if (receivedDay === bodyDay) return { occurredAt: receivedAt, timePrecision: 'minute' };
  return { occurredAt: new Date(`${bodyDay}T12:00:00+05:30`), timePrecision: 'day' };
}

/** "XX1234", "X123", "**1234", "1234" → the trailing digits (3 or 4). */
export function lastDigits(raw: string | undefined): string | undefined {
  const digits = /(\d{3,4})$/.exec((raw ?? '').replace(/\s/g, ''))?.[1];
  return digits;
}

/** A payee from an SMS: "SWIGGY LIMITED" → "Swiggy Limited"; VPAs keep the part before "@". */
export function payee(raw: string | undefined): string | undefined {
  let text = (raw ?? '').replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  if (text === '') return undefined;
  if (/^[\w.-]+@[\w.-]+$/.test(text)) text = text.split('@')[0]!.replace(/[._-]+/g, ' ');
  if (/^(VPA|UPI|NA|NULL)$/i.test(text)) return undefined;
  return titleCase(text);
}

export interface SmsFacts {
  bank: string;
  amountPaise: number;
  direction: Direction;
  receivedAt: Date;
  bodyDay?: string | null;
  last4?: string;
  kind?: AccountKind;
  counterparty?: string;
  referenceNo?: string;
  /** Words the type rules read ("ATM", "UPI", "REFUND"); never the SMS body itself. */
  narration: string;
}

/**
 * The NormalizedTxn for an SMS. rawText is never set: the message body stays on the phone, only
 * these parsed fields are sent. last4 is the account's (or credit card's) digits only: a debit
 * card spend leaves it out, because the card number names no account, and a made-up account
 * would stop the savings statement row from ever merging with it.
 */
export function smsTxn(f: SmsFacts): NormalizedTxn {
  const when = occurredAt(f.receivedAt, f.bodyDay ?? null);
  const txn: NormalizedTxn = {
    source: 'sms',
    amountPaise: paise(f.amountPaise),
    direction: f.direction,
    occurredAt: when.occurredAt,
    timePrecision: when.timePrecision,
    accountHint: { bank: f.bank, ...(f.last4 ? { last4: f.last4 } : {}), ...(f.kind ? { kind: f.kind } : {}) },
    narration: f.narration,
  };
  if (f.counterparty) txn.counterparty = f.counterparty;
  if (f.referenceNo) txn.referenceNo = f.referenceNo;
  return txn;
}

/** A 12-digit UPI RRN, or a 6+ character bank reference, from "Ref 427512345601" / "UPI:427512345601". */
export function reference(raw: string | undefined): string | undefined {
  const text = (raw ?? '').trim().replace(/[.,;)]+$/, '');
  return /^[A-Z0-9]{6,22}$/i.test(text) ? text.toUpperCase() : undefined;
}
