'use client';

import Link from 'next/link';

interface MobileHeaderProps {
  onToggleMenu: () => void;
  showBackButton?: boolean;
}

/**
 * Mobile header with hamburger menu button.
 * When showBackButton is true (post pages), shows a close button that links home.
 */
export function MobileHeader({ onToggleMenu, showBackButton }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/10 backdrop-blur-md px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-white focus:outline-none flex flex-col items-start gap-2">
        <h1 className="text-xl font-normal font-[family-name:var(--font-mondwest)]">
          Ani Dalal
        </h1>
      </Link>
      {showBackButton ? (
        <Link
          href="/"
          className="text-white focus:outline-none p-1"
          aria-label="Back to home"
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
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>
      ) : (
        <button
          onClick={onToggleMenu}
          className="text-white focus:outline-none p-1"
          aria-label="Open menu"
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
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
    </header>
  );
}
