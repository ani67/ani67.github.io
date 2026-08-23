'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GalleryEntry, GalleryEntryInput } from '@/lib/gallery';
import { WORK_PARAM } from './GalleryFilter';

// Guarded by a build-time constant, not just a runtime flag: Next inlines
// `process.env.NODE_ENV`, so in a production build this whole branch — and the
// import it contains — is dead code and the editor is never emitted at all.
const GalleryEditor =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./GalleryEditor').then((m) => m.GalleryEditor))
    : null;

interface GallerySurfaceProps {
  /** The server-rendered read-only grid, passed in so it costs no client JS. */
  view: ReactNode;
  /** Same grid, pre-rendered per tag, so filtering ships no extra JS. */
  filtered?: Record<string, ReactNode>;
  manifest: GalleryEntryInput[];
  entries: GalleryEntry[];
  /** True only in development. */
  canEdit: boolean;
}

/**
 * Shows the grid, or the editor when `?edit=1` and we're running locally.
 *
 * Edit mode lives in the URL rather than in state so it survives the
 * `router.refresh()` that follows every save.
 */
export function GallerySurface({ view, filtered, manifest, entries, canEdit }: GallerySurfaceProps) {
  const searchParams = useSearchParams();
  const editing = canEdit && searchParams.get('edit') === '1';

  if (!editing || !GalleryEditor) {
    const work = searchParams.get(WORK_PARAM);
    // Each filtered grid is rendered on the server and picked here, so
    // switching bodies of work costs no client-side rendering.
    return <>{(work && filtered?.[work]) || view}</>;
  }

  return <GalleryEditor manifest={manifest} entries={entries} />;
}
