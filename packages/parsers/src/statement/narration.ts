/**
 * Pulls a readable counterparty and a reference number out of Indian bank narrations:
 *   HDFC  "UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-UTIB0000100-412345678901-PAYMENT"
 *   ICICI "UPI/412345678901/SWIGGY/swiggy@icici/Payment"
 *   NEFT  "NEFT CR-HDFC0000001-ACME CORP PVT LTD-SALARY OCT-N123456789"
 *   IMPS  "IMPS-412345678901-RAVI KUMAR-SBIN-XXXXXX1234-RENT"
 *   Axis  "UPI/P2M/412345678901/SWIGGY LIMITED/UPI/YES BANK", "NEFT/AXISN26274123456/ACME CORP/…"
 *   SBI   "TO TRANSFER-UPI/DR/412345678901/SWIGGY L/YESB/…", "BY TRANSFER-NEFT*HDFC0000001*N2752612*ACME*"
 *   POS   "POS 416021XXXXXX1234 AMAZON PAY INDIA", "POS/AMAZON PAY INDIA/BANGALORE/271026"
 *   ATM   "ATW-416021XXXXXX1234-S1ANBG12-BANGALORE", "NWD-…", "ATM WDL-…", "NFS/CASH WDL/…"
 * Anything else keeps its text as the counterparty.
 */
export interface NarrationParts {
  counterparty?: string;
  referenceNo?: string;
}

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const RRN = /^\d{12}$/;
const VPA = /@/;
const CARD = /^\d{4,6}X+\d{2,4}$/;
/** Words that are channel or bank noise, never the counterparty. */
const NOISE = new Set(['UPI', 'NEFT', 'IMPS', 'RTGS', 'CR', 'DR', 'POS', 'PAYMENT', 'TRANSFER', 'P2A', 'P2M', 'NA', 'NULL', 'SENT USING PAYTM UPI']);

export function parseNarration(narration: string): NarrationParts {
  // SBI prefixes the channel with which side of the transfer this is; ICICI with "MMT/".
  const text = narration
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(TO|BY) (TRANSFER|CLEARING)\s*-\s*/i, '')
    .replace(/^MMT\//i, '');
  const upper = text.toUpperCase();
  if (upper === '') return {};

  if (/^(ATW|NWD|ATM|NFS)\b|\bCASH WDL\b/.test(upper)) return { counterparty: 'ATM withdrawal' };

  const pos = /^POS\/([^/]+)/.exec(upper) ?? /^POS\s+\S+\s+(.+)$/.exec(upper);
  if (pos) return { counterparty: titleCase(pos[1]!.trim()) };

  if (/^(UPI|NEFT|IMPS|RTGS)\b/.test(upper)) {
    const parts = upper
      .split(/[-/*]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const referenceNo = parts.find((p) => RRN.test(p));
    // A name has letters; references, IFSCs, VPAs, card numbers and 4-letter bank codes don't count.
    const name = parts
      .slice(1)
      .find(
        (p) => !NOISE.has(p) && !RRN.test(p) && !IFSC.test(p) && !VPA.test(p) && !CARD.test(p) && /[A-Z]{2}/.test(p) && !/^[A-Z]{4}$/.test(p) && !/\d{6,}/.test(p),
      );
    return { counterparty: name ? titleCase(stripCr(name)) : undefined, referenceNo };
  }

  return { counterparty: titleCase(text) };
}

/** "NEFT CR" leaves "CR " on some names. */
function stripCr(name: string): string {
  return name.replace(/^(CR|DR)\s+/, '');
}

/** Short words that are ordinary words, not acronyms like "KFC" or "ATM". */
const SHORT_WORDS = new Set(['and', 'the', 'of', 'pay', 'for', 'pvt', 'ltd', 'inc', 'llp', 'co', 'via', 'by', 'to', 'in', 'on', 'at', 'bar', 'cafe', 'mr', 'ms', 'dr']);

/** "SWIGGY LIMITED" → "Swiggy Limited", "ZOMATO LTD" → "Zomato Ltd"; keeps short acronyms like "KFC". */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 3 && /^[a-z]+$/.test(w) && !SHORT_WORDS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}
