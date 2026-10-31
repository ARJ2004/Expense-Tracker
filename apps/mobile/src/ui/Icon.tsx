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
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M14 6l4 4'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  backspace: ['M9 5h11v14H9l-6-7z', 'M12.5 9.5l5 5M17.5 9.5l-5 5'],
  sms: ['M4 5h16v11H8l-4 4z'],
  statement: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h7M9 17h7'],
  // Category icons (CATEGORY_ICONS in @et/domain).
  food: ['M7 3v8a2 2 0 0 0 2 2v8', 'M11 3v8a2 2 0 0 1-2 2', 'M17 21V3c-2 1-3 3.5-3 7h3'],
  groceries: ['M3 4h2l2.4 11h10.2L20 8H6.2'],
  transport: ['M4 16v-4.5L6.5 6h11l2.5 5.5V16z', 'M4 12h16', 'M6 16v2M18 16v2'],
  shopping: ['M5 8h14l-1 13H6z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  bills: ['M13 3 5 14h6l-1 7 8-11h-6z'],
  rent: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  entertainment: ['M4 5h16v14H4z', 'M10 9l5 3-5 3z'],
  health: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  education: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19a2 2 0 0 1 2-2h13'],
  travel: ['M2 13l20-8-6 16-3-7z'],
  transfer: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
  income: ['M12 4v14', 'M6 12l6 6 6-6'],
  other: [],
} as const;

const circles: Partial<Record<IconName, Array<[number, number, number]>>> = {
  settings: [
    [16, 6, 2],
    [10, 12, 2],
    [18, 18, 2],
  ],
  search: [[11, 11, 7]],
  groceries: [
    [9, 19, 1.5],
    [17, 19, 1.5],
  ],
  other: [
    [6, 12, 1.5],
    [12, 12, 1.5],
    [18, 12, 1.5],
  ],
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
