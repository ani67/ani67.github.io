'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { GalleryEntry } from '@/lib/gallery';
import { GalleryOverlay } from './GalleryOverlay';
import { PIECE_PARAM } from './piece-param';
import { track } from '@/lib/analytics';

interface GalleryOverlayHostProps {
  entries: GalleryEntry[];
}

/**
 * Opens the overlay for whichever piece `?piece=` names.
 *
 * The grid navigates; this listens. Nothing renders until a piece is selected,
 * so the homepage ships no overlay markup for the common case.
 */
export function GalleryOverlayHost({ entries }: GalleryOverlayHostProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openId = searchParams.get(PIECE_PARAM);
  // Never open over the editor: `?edit=1` owns the page, and its own tile
  // click opens the edit form rather than this.
  const editing = searchParams.get('edit') === '1';
  const openIndex = !editing && openId ? entries.findIndex((e) => e.id === openId) : -1;

  // Closing rewrites the URL rather than calling `router.back()`. Back was
  // going wherever history happened to point — which, after a trip through
  // edit mode, was `?edit=1`, so closing the overlay dropped you into the
  // editor. Replacing the URL always lands on the plain grid. Opening still
  // pushes, so the browser's own back button closes the overlay as before.
  const close = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  // Stepping replaces rather than pushes, so browsing the gallery doesn't bury
  // the grid under a dozen history entries.
  const step = useCallback((delta: number) => {
    if (openIndex < 0) return;
    const target = entries[(openIndex + delta + entries.length) % entries.length];
    router.replace(`${pathname}?${PIECE_PARAM}=${encodeURIComponent(target.id)}`, { scroll: false });
  }, [entries, openIndex, pathname, router]);

  const prev = useCallback(() => step(-1), [step]);
  const next = useCallback(() => step(1), [step]);

  // Which pieces get opened is the one thing the homepage's own page view can't
  // say. Keyed on the id so stepping between pieces reports each one, and a
  // re-render of the same piece reports nothing.
  const openedId = openIndex >= 0 ? entries[openIndex].id : null;
  useEffect(() => {
    if (!openedId) return;
    const entry = entries.find((e) => e.id === openedId);
    track('piece_open', {
      piece_id: openedId,
      piece_title: entry?.title,
      piece_tags: entry?.tags.join(','),
      piece_year: entry?.year,
    });
  }, [openedId, entries]);

  if (openIndex < 0) return null;

  return (
    <GalleryOverlay
      // Keyed so stepping to another piece remounts with fresh state.
      key={entries[openIndex].id}
      entry={entries[openIndex]}
      onClose={close}
      onPrev={entries.length > 1 ? prev : undefined}
      onNext={entries.length > 1 ? next : undefined}
    />
  );
}
