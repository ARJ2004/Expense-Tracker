import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Line icons from the locked mockups: 24×24 grid, 1.8 stroke, round caps. */
const paths = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  plus: ['M12 5v14M5 12h14'],
  upload: ['M12 16V4M7 9l5-5 5 5M4 20h16'],
  settings: ['M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12'],
  back: ['M15 5l-7 7 7 7'],
  chevron: ['m9 6 6 6-6 6'],
  search: ['m20 20-3.5-3.5'],
  filter: ['M4 6h16M7 12h10M10 18h4'],
  close: ['M6 6l12 12M18 6 6 18'],
} as const;

const circles: Partial<Record<IconName, Array<[number, number, number]>>> = {
  settings: [
    [16, 6, 2],
    [10, 12, 2],
    [18, 18, 2],
  ],
  search: [[11, 11, 7]],
};

export type IconName = keyof typeof paths;

export interface IconProps {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, color, size = 22, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name].map((d) => (
        <Path key={d} d={d} />
      ))}
      {circles[name]?.map(([cx, cy, r]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </Svg>
  );
}
