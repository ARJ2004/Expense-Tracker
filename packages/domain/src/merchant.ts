/**
 * The comparable form of a merchant name: upper case, letters and digits only (any script), single spaces.
 * "Swiggy", " SWIGGY. " and "swiggy" all become "SWIGGY", so one correction finds every row.
 * The ledger_search migration backfills transactions.merchant_key with the same rule in SQL.
 */
export function merchantKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return key.length > 0 ? key : null;
}
