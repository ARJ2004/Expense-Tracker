import React from 'react';
import { paletteColor, useTheme } from '../theme';
import { Icon, type IconName } from '../ui';

export interface CategoryIconProps {
  /** A CATEGORY_ICONS name; unknown names fall back to "other". */
  icon: string;
  /** A palette key; omit to draw in `tint` instead. */
  color?: string;
  tint?: string;
  size?: number;
}

const KNOWN = new Set<string>(['food', 'groceries', 'transport', 'shopping', 'bills', 'rent', 'entertainment', 'health', 'education', 'travel', 'transfer', 'income', 'other']);

/** A category's line icon in its palette colour (or a given tint, e.g. inside a selected chip). */
export function CategoryIcon({ icon, color, tint, size = 16 }: CategoryIconProps) {
  const { colors } = useTheme();
  const name = (KNOWN.has(icon) ? icon : 'other') as IconName;
  return <Icon name={name} size={size} color={tint ?? paletteColor(colors, color ?? 'muted')} />;
}
