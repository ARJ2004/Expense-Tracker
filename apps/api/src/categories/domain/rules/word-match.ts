import { merchantKey } from '@et/domain';

/** Text in merchantKey() form padded with spaces, so " SWIGGY " matches whole words only. */
export function padded(text: string | null | undefined): string | null {
  const key = merchantKey(text);
  return key ? ` ${key} ` : null;
}

/** True if any of the padded haystacks contains the pattern as whole words. */
export function containsWords(pattern: string, ...haystacks: (string | null)[]): boolean {
  const needle = ` ${pattern} `;
  return haystacks.some((h) => h !== null && h.includes(needle));
}
