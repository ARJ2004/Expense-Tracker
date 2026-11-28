/**
 * Colours the website uses that the app has no token for. Keep this list short: anything the app
 * also uses belongs in colors.ts.
 */
export const webColors = {
  /** Body text on navy (hero intros, card copy on #012A4A). */
  onNavyBody: '#CFE0EA',
  /** Card and border on navy. */
  navyRaised: '#0A3354',
  navyBorder: '#1B4C74',
  /** The stage behind phone mockups. */
  stage: '#F2F6F8',
  /** Altus column in comparison tables. */
  altusColumn: '#F2FBF6',
  /** Neutral fourth chart colour, also used for muted strokes. */
  slate: '#9FB2BF',
} as const;
