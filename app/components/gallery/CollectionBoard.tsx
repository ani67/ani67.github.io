'use client';

import { useEffect, useState } from 'react';
import { cldUrl, isTransformable } from '@/lib/cloudinary';

interface BoardItem { i: number; c: string }
interface BoardData { name: string; count: number; items: BoardItem[] }

/**
 * A collection shown the way a Behance board is: every image at full width,
 * stacked in order, butted together with no seam between them.
 *
 * The two Behance projects were laid out as single long boards — one image runs
 * straight into the next, and the join is part of the composition. Cutting them
 * into separate framed items and putting a rail underneath took a designed
 * artefact apart and presented the pieces. This puts it back together.
 *
 * `block` on the images is what closes the seam: images are inline by default,
 * and inline boxes sit on a text baseline, which leaves a few pixels of gap
 * under each one.
 */
export function CollectionBoard({ file, title }: { file: string; title: string }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/collections/${file}.json`)
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((json: BoardData) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [file]);

  if (failed) return null;

  if (!data) {
    return <div className="h-[70vh] w-full animate-pulse bg-surface" aria-hidden="true" />;
  }

  return (
    <div className="w-full">
      {data.items.map((item, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={item.i}
          className="block w-full"
          src={isTransformable(item.c) ? cldUrl(item.c, 1600) : item.c}
          alt={`${title} — ${n + 1} of ${data.items.length}`}
          // The top of the board is what a visitor sees first; the rest can wait
          // until they scroll to it, which on a board this tall is most of it.
          loading={n === 0 ? 'eager' : 'lazy'}
          decoding="async"
        />
      ))}
    </div>
  );
}
