'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode } from 'react';

/**
 * Theme provider wrapper for multi-color mode support
 * Supports: dawn (red), day (blue), night (dark), reader (light paper)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="night"
      themes={['dawn', 'day', 'night', 'reader']}
    >
      {children}
    </NextThemesProvider>
  );
}
