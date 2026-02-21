'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function FaviconSwitcher() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) return;
    favicon.href = resolvedTheme === 'night' ? '/favicon-white.svg' : '/favicon-black.svg';
  }, [resolvedTheme]);

  return null;
}
