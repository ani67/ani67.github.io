'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sunrise, Sun, Moon } from 'lucide-react';
import { NavigationLinks } from './NavigationLinks';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
}

export function MobileMenu({ isOpen, onClose, selectedTag, onTagSelect }: MobileMenuProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const themes = ['dawn', 'day', 'night'];
  const currentIndex = themes.indexOf(theme || 'day');
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  const getThemeIcon = () => {
    switch (theme) {
      case 'dawn': return <Sunrise className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'day':  return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'night': return <Moon className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      default:     return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
    }
  };

  const getThemeName = () => {
    switch (theme) {
      case 'dawn':  return 'Dawn';
      case 'day':   return 'Day';
      case 'night': return 'Night';
      default:      return 'Day';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="md:hidden fixed inset-0 bg-white/10 backdrop-blur-md z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Top: name + close button */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-white focus:outline-none" onClick={onClose}>
          <h1 className="text-xl font-normal font-[family-name:var(--font-mondwest)]">
            Ani Dalal
          </h1>
        </Link>
        <button onClick={onClose} className="text-white focus:outline-none p-1" aria-label="Close menu">
          <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Spacer — pushes nav to bottom */}
      <div className="flex-1" />

      {/* Bottom: nav options */}
      {onTagSelect && (
        <nav className="px-6 pb-4">
          <NavigationLinks
            selectedTag={selectedTag ?? null}
            onTagSelect={(tag) => { onTagSelect(tag); onClose(); }}
            listClassName="space-y-3"
            itemClassName="text-xl"
            inactiveClassName="text-white"
          />
        </nav>
      )}

      {/* Theme toggle */}
      {mounted && (
        <div className="px-6 pb-10">
          <button
            onClick={() => setTheme(nextTheme)}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors focus:outline-none"
            aria-label={`Switch to ${nextTheme} mode`}
          >
            <span className="text-xl font-[family-name:var(--font-mondwest)]">{getThemeName()}</span>
            {getThemeIcon()}
          </button>
        </div>
      )}
    </div>
  );
}
