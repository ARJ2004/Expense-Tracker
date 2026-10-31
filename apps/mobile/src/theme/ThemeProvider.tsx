import React, { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { altusDark, altusLight, type ColorTokens } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: altusLight });

/** Follows the phone's light/dark setting unless `scheme` forces one (Settings → Appearance). */
export function ThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: 'light' | 'dark' }>) {
  const system = useColorScheme();
  const active = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo<Theme>(
    () => ({ scheme: active, colors: active === 'dark' ? altusDark : altusLight }),
    [active],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
