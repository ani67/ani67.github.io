'use client';

import Link from 'next/link';

interface MobileHeaderProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/**
 * Mobile header with hamburger menu button
 */
export function MobileHeader({ menuOpen, onToggleMenu }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-sm border-b border-white/30 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-white focus:outline-none flex flex-col items-start gap-2">
        <h1 className="text-xl font-normal font-[family-name:var(--font-mondwest)]">
          Ani Dalal
        </h1>
      </Link>
      <button
        onClick={onToggleMenu}
        className="text-white focus:outline-none p-1"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {menuOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </header>
  );
}
