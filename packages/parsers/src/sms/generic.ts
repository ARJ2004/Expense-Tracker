import type { AccountKind, NormalizedTxn } from '@et/domain';
import { parseNarration } from '../statement/narration';
import { lastDigits, payee, reference, smsAmount, smsDay, smsTxn } from './helpers';

/**
 * Reads a transaction SMS from any bank by its wording, not by a per-bank template:
 *   SVC Bank A/c *1234 DEBITED for Rs.11.00 Clr Bal Rs.1,89,764.50. CR UPI/DR/427512345601/KALLAHALL/. …
 *   Rs.500 credited to Kotak Bank a/c XX1234 on 01-11-26 by UPI ref 427512345602 from ravi@okaxis
 *   INR 2,000.00 withdrawn at ATM from A/c no. XX1234 on 01Nov26. Avl bal INR 8,000.00
 * It needs a debit or credit word, an amount and something only a real alert carries (the account
 * or card's last digits, or a bank reference); anything less is not read. Promotions ("₹5,000
 * credited, claim now") are turned away before that. The balance is read past, never kept.
 */
export function readTransactionSms(body: string, receivedAt: Date, bank: string): NormalizedTxn | null {
  const text = body.replace(/\s+/g, ' ').trim();
  if (notATransaction(text)) return null;

  // "Debit card" and "credit card" name the card, not the direction.
  const words = text.replace(/\b(debit|credit)\s+card\b/gi, (m) => '_'.repeat(m.length));
  const direction = directionOf(words);
  if (!direction) return null;
  if (direction.direction === 'credit' && PROMOTION.test(text)) return null;

  const amountPaise = smsAmount(amountNear(text, direction.at));
  if (!amountPaise) return null;

  const card = /\b(credit|debit) card\b[^.]*?(?:ending(?: with)?|no\.?|number)?\s*[X*x.]*\s*(\d{4})\b/i.exec(text);
  const account = ACCOUNT.exec(text);
  const masked = /(?:^|[\s(:])[X*x]{2,}(\d{3,4})\b/.exec(text);
  const narrationDetail = DETAIL.exec(text)?.[1];
  const detail = narrationDetail ? parseNarration(narrationDetail) : {};
  const referenceNo = detail.referenceNo ?? reference(REFERENCE.exec(text)?.[1]) ?? upiRrn(text);

  // A debit card's number isn't the account's: it proves the alert is real but isn't sent as the
  // account, so the statement row (which names the account) can still merge with it.
  let last4: string | undefined;
  let kind: AccountKind | undefined;
  if (account) last4 = lastDigits(account[1]);
  else if (card && card[1]!.toLowerCase() === 'credit') [last4, kind] = [card[2], 'credit_card'];
  else if (!card && masked) last4 = lastDigits(masked[1]);
  if (!last4 && !card && !referenceNo) return null;

  const atm = /\bATM\b|\bcash (withdrawal|wdl)\b/i.test(text);
  const channel = /\b(UPI|NEFT|IMPS|RTGS)\b/i.exec(text)?.[1]?.toUpperCase();
  const narration = atm
    ? 'ATM WITHDRAWAL'
    : direction.direction === 'credit'
      ? /\brefund/i.test(text) ? 'REFUND' : 'CREDIT'
      : card
        ? 'CARD'
        : (channel ?? 'DEBIT');

  return smsTxn({
    bank,
    amountPaise,
    direction: direction.direction,
    receivedAt,
    bodyDay: dayNear(text, receivedAt),
    last4,
    ...(kind ? { kind } : {}),
    counterparty: atm ? 'ATM withdrawal' : (detail.counterparty ?? counterpartyOf(text, direction.direction)),
    referenceNo,
    narration,
  });
}

/** Not a completed transaction even though it may say "credited" or "debited". */
function notATransaction(text: string): boolean {
  return /\b(will|to|shall|can|could|would|may) be (credited|debited|deducted)\b/i.test(text)
    || /\bget (Rs\.?|INR|₹)/i.test(text)
    // A card bill paid: the bank account's debit is the spend, this would count it twice.
    || (/\bcard\b/i.test(text) && /\bpayment\b.{0,60}\breceived\b|\breceived\b.{0,60}\bpayment\b/i.test(text))
    || (/\b(balance|bal) (is|as on|as of)\b/i.test(text) && !/\b(debited|credited|spent|withdrawn|sent|paid|received)\b/i.test(text));
}

/** What a promotion says and a bank's credit alert doesn't. A credit with any of it is not read. */
const PROMOTION =
  /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(ly|in|com|co|me|link)\/|\b(win|won|winner|claim|congrat\w*|reward\w*|lucky|pre-?approved|eligible|bonus|gift|voucher|offer|up ?to|apply|kyc|click)\b/i;

const DEBIT = /\b(debited|spent|withdrawn|sent|paid|purchased?|deducted|transferred to)\b/i;
const CREDIT = /\b(credited|received|deposited|refunded|refund of|added to)\b/i;

/** The first debit or credit word decides; "Dr"/"Cr" count only when there is no word at all. */
function directionOf(text: string): { direction: 'debit' | 'credit'; at: number } | null {
  const d = DEBIT.exec(text);
  const c = CREDIT.exec(text);
  if (d && (!c || d.index <= c.index)) return { direction: 'debit', at: d.index };
  if (c) return { direction: 'credit', at: c.index };
  const dr = /\bDR\b|\bDebit\b/i.exec(text);
  const cr = /\bCR\b|\bCredit\b/i.exec(text);
  if (dr && (!cr || dr.index <= cr.index)) return { direction: 'debit', at: dr.index };
  return cr ? { direction: 'credit', at: cr.index } : null;
}

const MONEY = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;
/** Words that make the amount after them a balance or limit, never the payment. */
const NOT_THE_PAYMENT = /\b(bal(ance)?|avl|avail(able)?|limit|lmt|due|outstanding|total|min(imum)?)\b[^\d]{0,12}$/i;

/** The amount nearest the debit or credit word that isn't a balance, limit or amount due. */
function amountNear(text: string, at: number): string | undefined {
  let best: { raw: string; distance: number } | null = null;
  for (const m of text.matchAll(MONEY)) {
    if (NOT_THE_PAYMENT.test(text.slice(Math.max(0, m.index - 24), m.index))) continue;
    const distance = Math.abs(m.index - at);
    if (!best || distance < best.distance) best = { raw: m[0], distance };
  }
  if (best) return best.raw;
  // "debited by 486.0": no currency, right after the word.
  return /\b(?:debited|credited) (?:by|for|with) ([\d,]+\.\d{1,2})\b/i.exec(text.slice(at))?.[1];
}

const ACCOUNT = /\b(?:a\/c|acct|account|ac)\.?(?:\s*no\.?)?(?:\s*ending(?: with)?)?[\s:]*[X*x.]*\s*(\d{3,4})\b/i;
/** "UPI/DR/427512345601/NAME", "NEFT-AXIS…-ACME CORP", "IMPS/…": the statement's narration. */
const DETAIL = /\b((?:UPI|NEFT|IMPS|RTGS)[/*-]\S*(?: (?!AVL\b|BAL\b|NOT\b|ON\b|REF\b|INR\b|RS\b)[A-Z][A-Z&']*)*)/;
const REFERENCE = /\b(?:UPI\s*Ref(?:erence)?\.?(?:\s*No\.?)?|Ref(?:erence)?\.?(?:\s*No\.?)?|RRN|UTR(?:\s*No\.?)?|Txn\s*(?:ID|No\.?))[\s:#.-]*([A-Z0-9]*\d[A-Z0-9]*)\b/i;

/** A bare 12-digit UPI RRN, only in a message that is about UPI. */
function upiRrn(text: string): string | undefined {
  return /\bUPI\b/i.test(text) ? /(?<!\d)(\d{12})(?!\d)/.exec(text)?.[1] : undefined;
}

/** A UPI ID, or the name after "to"/"at" (a debit) or "from"/"by" (a credit). */
function counterpartyOf(text: string, direction: 'debit' | 'credit'): string | undefined {
  const vpa = /\b([\w.-]+@[a-z][\w.-]*)\b/i.exec(text)?.[1];
  if (vpa && !/\.(com|in|co)$/i.test(vpa)) return payee(vpa);
  const lead = direction === 'debit' ? '(?:to|at|towards)' : '(?:from|by)';
  const m = new RegExp(String.raw`\b${lead} (?!your\b|a\/c\b|ac\b|acct|account\b|card\b|UPI\b|NEFT\b|IMPS\b|RTGS\b|XX|\*)([A-Z][\w&' .-]{1,40}?)(?= on\b| via\b| ref\b| UPI\b| for\b| avl\b| bal\b| is\b|[.,(;]|$)`, 'i').exec(text);
  return m ? payee(m[1]) : undefined;
}

/** A day written in the body, when it is a plausible one (the week before the SMS arrived). */
function dayNear(text: string, receivedAt: Date): string | null {
  const raw = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[-\s]?[A-Z][a-z]{2}[-\s]?\d{2,4})\b/i.exec(text)?.[1];
  const day = smsDay(raw);
  if (!day) return null;
  const at = Date.parse(`${day}T12:00:00+05:30`);
  return at <= receivedAt.getTime() + 86_400_000 && at >= receivedAt.getTime() - 7 * 86_400_000 ? day : null;
}
