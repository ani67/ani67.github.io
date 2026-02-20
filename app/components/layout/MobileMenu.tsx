'use client';

import { useEffect } from 'react';
import { NavigationLinks } from './NavigationLinks';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
}

/**
 * Mobile menu overlay with navigation links
 * Includes keyboard support (Escape to close)
 */
export function MobileMenu({ isOpen, onClose, selectedTag, onTagSelect }: MobileMenuProps) {
  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll when menu is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <nav
        className="fixed top-0 right-0 h-full w-64 bg-white dark:bg-black dawn:bg-black day:bg-black night:bg-black border-l border-gray-200 dark:border-gray-800 p-8 pt-20"
        onClick={(e) => e.stopPropagation()}
      >
        {onTagSelect ? (
          <NavigationLinks
            selectedTag={selectedTag ?? null}
            onTagSelect={onTagSelect}
          />
        ) : null}
      </nav>
    </div>
  );
}
