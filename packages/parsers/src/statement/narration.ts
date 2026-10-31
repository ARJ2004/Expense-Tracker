/**
 * Pulls a readable counterparty and a reference number out of Indian bank narrations:
 *   HDFC  "UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-UTIB0000100-412345678901-PAYMENT"
 *   ICICI "UPI/412345678901/SWIGGY/swiggy@icici/Payment"
 *   NEFT  "NEFT CR-HDFC0000001-ACME CORP PVT LTD-SALARY OCT-N123456789"
 *   IMPS  "IMPS-412345678901-RAVI KUMAR-SBIN-XXXXXX1234-RENT"
 *   POS   "POS 416021XXXXXX1234 AMAZON PAY INDIA"
 *   ATM   "ATW-416021XXXXXX1234-S1ANBG12-BANGALORE", "NWD-…"
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
  const text = narration.replace(/\s+/g, ' ').trim();
  const upper = text.toUpperCase();
  if (upper === '') return {};

  if (/^(ATW|NWD|ATM)\b/.test(upper)) return { counterparty: 'ATM withdrawal' };

  const pos = /^POS\s+\S+\s+(.+)$/.exec(upper);
  if (pos) return { counterparty: titleCase(pos[1]!) };

  if (/^(UPI|NEFT|IMPS|RTGS)\b/.test(upper)) {
    const parts = upper
      .split(/[-/]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const referenceNo = parts.find((p) => RRN.test(p));
    const name = parts
      .slice(1)
      .find((p) => !NOISE.has(p) && !RRN.test(p) && !IFSC.test(p) && !VPA.test(p) && !CARD.test(p) && /[A-Z]{2}/.test(p) && !/^[A-Z]{4}$/.test(p));
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
