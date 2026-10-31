import type { ColorTokens } from './tokens';

/**
 * Category colours are stored as palette keys (CATEGORY_COLORS in @et/domain), never hex.
 * This maps a key to the current theme's token, so a category reads well in light and dark.
 */
export function paletteColor(colors: ColorTokens, key: string): string {
  switch (key) {
    case 'chart1':
      return colors.chart[0];
    case 'chart2':
      return colors.chart[1];
    case 'chart3':
      return colors.chart[2];
    case 'chart4':
      return colors.chart[3];
    case 'chart5':
      return colors.chart[4];
    case 'accent':
      return colors.accent;
    case 'warning':
      return colors.warningOn;
    default:
      return colors.textMuted;
  }
}
