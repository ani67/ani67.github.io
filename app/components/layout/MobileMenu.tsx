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
}

export function MobileMenu({ isOpen, onClose, selectedTag, onTagSelect }: MobileMenuProps) {
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
      className="md:hidden fixed inset-0 bg-white/10 backdrop-blur-md z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Top bar: name + close button */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-white focus:outline-none"
          onClick={onClose}
        >
          <h1 className="text-xl font-normal font-[family-name:var(--font-mondwest)]">
            Ani Dalal
          </h1>
        </Link>
        <button
          onClick={onClose}
          className="text-white focus:outline-none p-1"
          aria-label="Close menu"
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
        </button>
      </div>

      {/* Nav options */}
      <nav className="px-6 py-4">
        {onTagSelect ? (
          <NavigationLinks
            selectedTag={selectedTag ?? null}
            onTagSelect={(tag) => {
              onTagSelect(tag);
              onClose();
            }}
            listClassName="space-y-3"
            itemClassName="text-2xl"
          />
        ) : null}
      </nav>
    </div>
  );
}
