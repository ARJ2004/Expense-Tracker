/**
 * Who sent an SMS. Every business in India sends from a registered 6-character header, shown with
 * the operator's 2-letter prefix ("VM-", "VH-", "AD-"; some phones drop it) and, since TRAI's 2023
 * rules, a category suffix: -T transactional, -S service, -P promotional, -G government. People send
 * from phone numbers. Only business senders are ever read, and promotional ones never.
 */

export type SenderCategory = 'T' | 'S' | 'P' | 'G';

export interface SmsSender {
  /** The registered header without prefix or suffix: "SVCBNK". */
  code: string;
  category: SenderCategory | null;
}

const HEADER = /^(?:[A-Z]{2}-)?([A-Z0-9]{6})(?:-([STPG]))?$/i;

/**
 * Business senders other than promotional ones, as regex source for the Android module's inbox
 * filter: a phone number or a "-P" header never leaves the phone's SMS store. Only syntax that
 * JavaScript and Kotlin read alike; matched case-insensitively.
 */
export const TRANSACTION_SENDER = /^([A-Z]{2}-){0,1}[A-Z0-9]{6}(-[STG]){0,1}$/i;

/** The header's parts, or null for a phone number, a name or anything else that isn't a business header. */
export function parseSender(raw: string): SmsSender | null {
  const m = HEADER.exec(raw.trim());
  // A header has letters: an all-digit "header" is a short code or part of a phone number.
  if (!m || !/[A-Z]/i.test(m[1]!)) return null;
  return { code: m[1]!.toUpperCase(), category: (m[2]?.toUpperCase() as SenderCategory | undefined) ?? null };
}

/** True for a sender whose messages may be read: a business header that isn't promotional. */
export function isTransactionSender(raw: string): boolean {
  const sender = parseSender(raw);
  return sender !== null && sender.category !== 'P';
}

/**
 * Headers of banks we know by name. A lookup for the account's bank name and for trusting the
 * sender without asking; any other sender still works, the person confirms it once.
 */
export const BANK_HEADERS: Readonly<Record<string, string>> = {
  HDFCBK: 'HDFC Bank',
  HDFCBN: 'HDFC Bank',
  SBIINB: 'SBI',
  SBIUPI: 'SBI',
  SBIPSG: 'SBI',
  SBICRD: 'SBI',
  ATMSBI: 'SBI',
  CBSSBI: 'SBI',
  ICICIB: 'ICICI Bank',
  ICICIT: 'ICICI Bank',
  AXISBK: 'Axis Bank',
  AXISBN: 'Axis Bank',
  SVCBNK: 'SVC Bank',
  KOTAKB: 'Kotak Mahindra Bank',
  BOBTXN: 'Bank of Baroda',
  BOBSMS: 'Bank of Baroda',
  PNBSMS: 'Punjab National Bank',
  CANBNK: 'Canara Bank',
  UNIONB: 'Union Bank of India',
  IDFCFB: 'IDFC FIRST Bank',
  INDUSB: 'IndusInd Bank',
  YESBNK: 'Yes Bank',
  FEDBNK: 'Federal Bank',
  AUBANK: 'AU Small Finance Bank',
};
