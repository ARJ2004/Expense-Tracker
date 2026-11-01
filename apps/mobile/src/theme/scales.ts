/** 4-px spacing grid: 20 screen padding, 16 between blocks, 18–22 inside cards. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const radius = { sm: 12, md: 16, card: 28, pill: 999 } as const;

/** Minimum touch target for anything tappable. */
export const touchTarget = 44;

export const fonts = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  monoMedium: 'IBMPlexMono-Medium',
  monoSemibold: 'IBMPlexMono-SemiBold',
  /** Wordmark only. */
  display: 'Montserrat-ExtraBold',
} as const;

/**
 * Type scale: 40 wordmark and hero amount · 28 step headline · 24 screen title · 22 figure ·
 * 20 lead · 17 section heading · 15 body · 13 secondary and eyebrow · 12 labels.
 */
export const typeScale = {
  wordmark: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, letterSpacing: -0.8 },
  headline: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
  hero: { fontFamily: fonts.monoSemibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.6 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  /** A short statement on a card (the Sign in pitch, a file name). */
  lead: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  secondary: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  /** The small line at the top of a hero card ("Spent this month"). */
  eyebrow: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16 },
  mono: { fontFamily: fonts.monoSemibold, fontSize: 15, lineHeight: 20 },
  /** A count or figure that leads a summary (Import review). */
  figure: { fontFamily: fonts.monoSemibold, fontSize: 22, lineHeight: 28 },
} as const;

export type TypeVariant = keyof typeof typeScale;
