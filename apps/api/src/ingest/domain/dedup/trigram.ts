/** Company-form words banks append to merchant names ("Swiggy Limited", "Uber India Systems Pvt"). */
const COMPANY_WORDS = new Set(['limited', 'ltd', 'pvt', 'private', 'india', 'llp', 'inc', 'co', 'company', 'corp', 'corporation', 'technologies', 'tech', 'services', 'systems', 'solutions', 'retail', 'online']);

/**
 * Trigram similarity computed the way Postgres pg_trgm does: lower-case words of letters and
 * digits, each padded with two spaces in front and one behind, compared as sets (|A∩B| / |A∪B|).
 * Company-form words are dropped first, so a typed "Swiggy" matches the bank's "SWIGGY LIMITED".
 */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

function trigrams(text: string): Set<string> {
  const out = new Set<string>();
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const core = words.filter((w) => !COMPANY_WORDS.has(w));
  for (const word of core.length > 0 ? core : words) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}
