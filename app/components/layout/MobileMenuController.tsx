'use client';

import { useState } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileMenu } from './MobileMenu';

interface MobileMenuControllerProps {
  showBackButton?: boolean;
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
}

export function MobileMenuController({ showBackButton, popularTags, selectedTag, onTagSelect, useLinks }: MobileMenuControllerProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <MobileHeader
        onToggleMenu={() => setMenuOpen(!menuOpen)}
        showBackButton={showBackButton}
      />
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        popularTags={popularTags}
        selectedTag={selectedTag}
        onTagSelect={onTagSelect}
        useLinks={useLinks}
      />
    </>
  );
}
