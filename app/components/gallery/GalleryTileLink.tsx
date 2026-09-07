'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PROJECT_LINKS } from '@/lib/work-links';
import { PIECE_PARAM } from './piece-param';
import { TILE_CLASS } from './grid-style';

/** A crawlable project URL; ordinary clicks retain the gallery interaction. */
export function GalleryTileLink({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const router = useRouter();
  const overlay = `/?${PIECE_PARAM}=${encodeURIComponent(id)}`;
  return <Link
    href={PROJECT_LINKS[id] || overlay}
    prefetch={false}
    scroll={false}
    aria-haspopup="dialog"
    aria-label={title}
    className={`${TILE_CLASS} focus:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
    onNavigate={(event) => {
      event.preventDefault();
      const query = new URLSearchParams(window.location.search);
      query.set(PIECE_PARAM, id);
      router.push(`/?${query}`, { scroll: false });
    }}
  >{children}</Link>;
}
