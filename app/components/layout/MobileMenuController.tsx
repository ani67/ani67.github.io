'use client';

import { useState } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileMenu } from './MobileMenu';

interface MobileMenuControllerProps {
  showBackButton?: boolean;
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
}

export function MobileMenuController({ showBackButton, selectedTag, onTagSelect, useLinks }: MobileMenuControllerProps) {
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
        selectedTag={selectedTag}
        onTagSelect={onTagSelect}
        useLinks={useLinks}
      />
    </>
  );
}
