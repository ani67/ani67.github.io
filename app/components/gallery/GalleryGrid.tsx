'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { GalleryEntry } from '@/lib/gallery';
import { GalleryThumb } from './GalleryThumb';
import { PIECE_PARAM } from './piece-param';
import {
  TILE_CLASS, ABOVE_FOLD, ROWS_CLASS, ROW_CLASS, ROW_SUM,
  packRows, type PackedRow,
} from './grid-style';

interface GalleryGridProps {
  entries: GalleryEntry[];
}

const ratioOf = (e: GalleryEntry) => {
  const r = e.media[0]?.ratio;
  return r && r > 0 ? r : 1;
};

/** Widest breakpoint whose ratio-sum suits the current viewport. */
function rowSum(): number {
  if (typeof window === 'undefined') return ROW_SUM.lg;
  if (window.matchMedia('(min-width: 1024px)').matches) return ROW_SUM.lg;
  if (window.matchMedia('(min-width: 640px)').matches) return ROW_SUM.md;
  return ROW_SUM.sm;
}

/**
 * The grid of tiles, as visitors see it.
 *
 * Every row is packed to the same sum of aspect ratios, which is what makes
 * every row the same height — see `packRows`. Tiles keep close to their true
 * proportions; the small adjustment needed to make a row add up is taken mostly
 * from the widest frames, which crop without anyone noticing.
 *
 * Deliberately silent at rest — no titles, no captions, nothing on hover. The
 * work speaks; naming it is the overlay's job.
 *
 * The running order arrives already decided — newest first, from the server —
 * so this only decides where the rows break.
 *
 * Which piece is open lives in the URL (`/?piece=instrument`), so a tile is an
 * ordinary link rather than a button wired to state: linkable, openable in a
 * new tab, and working before hydration.
 */
export function GalleryGrid({ entries }: GalleryGridProps) {
  // Server and first paint pack at the widest breakpoint, so the markup is
  // stable and hydration matches; the effect below re-packs for narrower ones.
  const [rows, setRows] = useState<PackedRow<GalleryEntry>[]>(
    () => packRows(entries, ratioOf, ROW_SUM.lg),
  );

  useEffect(() => {
    const relayout = () => setRows(packRows(entries, ratioOf, rowSum()));
    // Deferred a frame so this isn't a synchronous state write during mount.
    const id = requestAnimationFrame(relayout);

    const queries = ['(min-width: 1024px)', '(min-width: 640px)'].map((q) => window.matchMedia(q));
    // Repack on breakpoint change only — not on every resize, since row height
    // follows the width for free.
    const onChange = () => setRows((prev) => packRows(prev.flatMap((r) => r.tiles.map((t) => t.item)), ratioOf, rowSum()));
    queries.forEach((q) => q.addEventListener('change', onChange));

    return () => {
      cancelAnimationFrame(id);
      queries.forEach((q) => q.removeEventListener('change', onChange));
    };
  }, [entries]);

  let index = 0;
  return (
    <div className={ROWS_CLASS}>
      {rows.map((row, r) => (
        <ul key={r} className={ROW_CLASS}>
          {row.tiles.map(({ item, ratio }) => {
            const eager = index++ < ABOVE_FOLD;
            return (
              <li key={item.id} style={{ flexGrow: ratio, flexBasis: 0, aspectRatio: `${ratio}` }}>
                <Link
                  href={`?${PIECE_PARAM}=${encodeURIComponent(item.id)}`}
                  scroll={false}
                  aria-haspopup="dialog"
                  aria-label={item.title}
                  className={`${TILE_CLASS} focus:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
                >
                  <GalleryThumb media={item.media[0]} title={item.title} priority={eager} />
                </Link>
              </li>
            );
          })}
          {row.filler > 0 && (
            <li style={{ flexGrow: row.filler, flexBasis: 0 }} aria-hidden="true" />
          )}
        </ul>
      ))}
    </div>
  );
}
