'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sunrise, Sun, Moon } from 'lucide-react';
import { ScrambleText } from '../ScrambleText';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

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

  const getThemeName = () => {
    switch (theme) {
      case 'dawn': return 'Dawn';
      case 'day': return 'Day';
      case 'night': return 'Night';
      default: return 'Day';
    }
  };

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="mt-8 flex items-center gap-2 text-white/50 hover:text-white transition-colors focus:outline-none group"
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <span className="text-xl font-[family-name:var(--font-mondwest)]">
        <ScrambleText key={theme} text={getThemeName()} />
      </span>
      {getThemeIcon()}
    </button>
  );
}

export function MobileThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const themes = ['dawn', 'day', 'night'];
  const currentIndex = themes.indexOf(theme || 'day');
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  const getThemeIcon = () => {
    switch (theme) {
      case 'dawn': return <Sunrise className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'day': return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'night': return <Moon className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      default: return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
    }
  };

  const getThemeName = () => {
    switch (theme) {
      case 'dawn': return 'Dawn';
      case 'day': return 'Day';
      case 'night': return 'Night';
      default: return 'Day';
    }
  };

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="flex items-center gap-2 text-white/50 hover:text-white transition-colors focus:outline-none"
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <span className="text-xl font-[family-name:var(--font-mondwest)]">{getThemeName()}</span>
      {getThemeIcon()}
    </button>
  );
}
