import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';

export interface LogoProps {
  size?: number;
  /** Colour of the notch in the front peak; defaults to the screen background it sits on. */
  cutout?: string;
}

/** The Altus mark: two peaks with a notch cut in the background colour. */
export function Logo({ size = 88, cutout }: LogoProps) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityRole="image" accessibilityLabel="Altus logo">
      <Path d="M8 104 L46 40 L84 104 Z" fill={colors.brandTeal} />
      <Path d="M36 104 L76 18 L116 104 Z" fill={colors.highlight} />
      <Path d="M62 48 L76 18 L90 48 L82 42 L76 50 L70 42 Z" fill={cutout ?? colors.background} />
    </Svg>
  );
}
