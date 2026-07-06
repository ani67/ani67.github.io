'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sunrise, Sun, Moon, BookOpen } from 'lucide-react';
import { ScrambleText } from '../ScrambleText';

export function ThemeToggle({ inline }: { inline?: boolean } = {}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const themes = ['dawn', 'day', 'night', 'reader'];
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
      case 'reader':
        return <BookOpen className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      default:
        return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
    }
  };

  const getThemeName = () => {
    switch (theme) {
      case 'dawn': return 'Dawn';
      case 'day': return 'Day';
      case 'night': return 'Night';
      case 'reader': return 'Reader';
      default: return 'Day';
    }
  };

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className={`${inline ? '' : 'mt-8 '}flex items-center gap-2 text-white/50 hover:text-white transition-colors focus:outline-none group`}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      <span className="text-xl font-[family-name:var(--font-mondwest)]">
        <ScrambleText key={theme} text={getThemeName()} />
      </span>
      {getThemeIcon()}
    </button>
  );
}

