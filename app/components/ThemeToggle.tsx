'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sunrise, Sun, Moon } from 'lucide-react';

/**
 * Theme toggle button for cycling through color modes: dawn, day, night
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-lg" aria-label="Toggle theme">
        <div className="w-5 h-5" />
      </button>
    );
  }

  const themes = ['dawn', 'day', 'night'];
  const currentIndex = themes.indexOf(theme || 'dawn');
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  const getThemeIcon = () => {
    switch (theme) {
      case 'dawn':
        return <Sunrise className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'day':
        return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'night':
        return <Moon className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      default:
        return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
    }
  };

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="p-2 rounded-lg hover:bg-white/20 focus:outline-none transition-colors"
      aria-label={`Switch to ${nextTheme} mode`}
    >
      {getThemeIcon()}
    </button>
  );
}
