/**
 * Altus colour tokens. Both themes have the same keys, so components never hard-code a colour.
 * Values are the locked tables in the design doc ("Visual design").
 */
export interface ColorTokens {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  hero: string;
  heroBorder: string;
  heroText: string;
  heroMuted: string;
  heroTrack: string;
  /** "56% used" pill on the hero card. */
  heroPillBg: string;
  heroPillFg: string;
  /** Income figure on the hero card. */
  heroIncome: string;
  highlight: string;
  /** Links and green text; emerald is a fill only on light backgrounds. */
  accent: string;
  accentSoft: string;
  accentOnSoft: string;
  track: string;
  income: string;
  spend: string;
  navBar: string;
  navBorder: string;
  navInactive: string;
  navActiveBg: string;
  navActive: string;
  addBg: string;
  addFg: string;
  primaryBg: string;
  primaryFg: string;
  chipOnBg: string;
  chipOnFg: string;
  warningSoft: string;
  warningOn: string;
  errorSoft: string;
  errorOn: string;
  scrim: string;
  /** Brand mark: teal back peak (the front peak is highlight). */
  brandTeal: string;
  /** The "G" on the Continue with Google button. */
  googleBlue: string;
  chart: readonly [string, string, string, string, string];
}

export const altusLight: ColorTokens = {
  background: '#F8F9F9',
  surface: '#FFFFFF',
  border: '#DCE3E8',
  text: '#012A4A',
  textMuted: '#4A6378',
  hero: '#012A4A',
  heroBorder: '#012A4A',
  heroText: '#FFFFFF',
  heroMuted: '#9FC3D8',
  heroTrack: 'rgba(255,255,255,0.14)',
  heroPillBg: 'rgba(46,204,113,0.18)',
  heroPillFg: '#BFF2D4',
  heroIncome: '#2ECC71',
  highlight: '#2ECC71',
  accent: '#14804A',
  accentSoft: '#E3F5EA',
  accentOnSoft: '#0E5A34',
  track: '#E8EEF1',
  income: '#14804A',
  spend: '#C0392B',
  navBar: '#012A4A',
  navBorder: '#012A4A',
  navInactive: '#8FA9BC',
  navActiveBg: 'rgba(46,204,113,0.18)',
  navActive: '#2ECC71',
  addBg: '#2ECC71',
  addFg: '#012A4A',
  primaryBg: '#012A4A',
  primaryFg: '#FFFFFF',
  chipOnBg: '#012A4A',
  chipOnFg: '#FFFFFF',
  warningSoft: '#FCEFD9',
  warningOn: '#8A5A12',
  errorSoft: '#FBEAEA',
  errorOn: '#A3261C',
  scrim: 'rgba(1,42,74,0.45)',
  brandTeal: '#17A2B8',
  googleBlue: '#4285F4',
  chart: ['#012A4A', '#2ECC71', '#17A2B8', '#9FB2BF', '#E8A33D'],
};

export const altusDark: ColorTokens = {
  background: '#00111F',
  surface: '#071D30',
  border: '#14324B',
  text: '#EAF2F6',
  textMuted: '#9DB3C2',
  hero: '#0A3354',
  heroBorder: '#1B4C74',
  heroText: '#FFFFFF',
  heroMuted: '#9FC3D8',
  heroTrack: 'rgba(255,255,255,0.12)',
  heroPillBg: 'rgba(46,204,113,0.18)',
  heroPillFg: '#BFF2D4',
  heroIncome: '#5FE09A',
  highlight: '#2ECC71',
  accent: '#2ECC71',
  accentSoft: '#0D3B2A',
  accentOnSoft: '#7EE2A8',
  track: '#12304A',
  income: '#5FE09A',
  spend: '#FF8A80',
  navBar: '#FFFFFF',
  navBorder: '#14324B',
  navInactive: '#5E7385',
  navActiveBg: '#E3F5EA',
  navActive: '#0E5A34',
  addBg: '#012A4A',
  addFg: '#2ECC71',
  primaryBg: '#2ECC71',
  primaryFg: '#012A4A',
  chipOnBg: '#2ECC71',
  chipOnFg: '#012A4A',
  warningSoft: '#3A2A12',
  warningOn: '#F0BE73',
  errorSoft: '#3A1A1D',
  errorOn: '#FF8A80',
  scrim: 'rgba(0,0,0,0.6)',
  brandTeal: '#17A2B8',
  googleBlue: '#4285F4',
  chart: ['#2ECC71', '#17A2B8', '#5C8FC0', '#5E7385', '#E8A33D'],
};
