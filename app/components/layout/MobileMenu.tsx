'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { NavigationLinks } from './NavigationLinks';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
}

export function MobileMenu({ isOpen, onClose, selectedTag, onTagSelect, useLinks }: MobileMenuProps) {
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

      {/* Bottom: nav options — NavigationLinks already includes the theme
          toggle inline (after About), so no separate block here. */}
      {(onTagSelect || useLinks) && (
        <nav className="px-6 pb-10">
          <NavigationLinks
            selectedTag={selectedTag ?? null}
            onTagSelect={onTagSelect ? (tag) => { onTagSelect(tag); onClose(); } : undefined}
            useLinks={useLinks}
            listClassName="space-y-3"
            itemClassName="text-xl"
            inactiveClassName="text-white"
          />
        </nav>
      )}
    </div>
  );
}
