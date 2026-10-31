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
} as const;

/** Type scale: 40 hero amount · 24 screen title · 17 section heading · 15 body · 13 secondary · 12 labels. */
export const typeScale = {
  hero: { fontFamily: fonts.monoSemibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.6 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  secondary: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: fonts.monoSemibold, fontSize: 15, lineHeight: 20 },
} as const;

export type TypeVariant = keyof typeof typeScale;
