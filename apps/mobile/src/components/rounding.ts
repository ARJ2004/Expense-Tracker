/** Summary figures (hero, category bars) read in whole rupees, as in the Home mockup; lists keep paise. */
export function wholeRupees(paise: number): number {
  return Math.round(paise / 100) * 100;
}
