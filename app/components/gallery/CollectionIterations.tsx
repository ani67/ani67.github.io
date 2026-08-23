'use client';

import { useEffect, useState } from 'react';
import { displayRatio } from './grid-style';
import { cldUrl, isTransformable } from '@/lib/cloudinary';

interface Iteration {
  /** Iteration number within the collection, e.g. 128 for "THE END #128". */
  i: number;
  /** IPFS CID of the still preview. */
  c: string;
  /**
   * Set when fxhash's preview for this iteration captured blank — the snapshot
   * fired before the scene had drawn. 18 of 2725 are like this. The iteration
   * is real, so it stays listed, but showing its "preview" would just be a
   * black square that reads as a broken image. Its live version still runs, so
   * a blank preview is only a missing thumbnail, not a missing piece.
   */
  b?: number;
  /** fxhash generation hash — the seed that reproduces this exact iteration. */
  h?: string;
  /**
   * A clip, for collections whose items move. `c` is still the still used in
   * the rail — Cloudinary will hand back a frame of the video as an image, so
   * a moving item costs the rail nothing extra.
   */
  v?: string;
  /**
   * An embed URL, for an item that is someone else's player rather than a file
   * of ours — a talk on YouTube sitting alongside the drawings it describes.
   */
  e?: string;
  /**
   * This item's own proportions, when they differ from the collection's. The
   * rail stays uniform either way — a thumbnail is a thumbnail — but the stage
   * uses it, so a 16:9 film among 2:1 drawings plays at 16:9 instead of being
   * letterboxed into the shape of its neighbours.
   */
  r?: number;
}

interface CollectionData {
  name: string;
  count: number;
  items: Iteration[];
  /**
   * IPFS CID of the token's generator, shared by every iteration. Present only
   * for fxhash collections; a series of plain photographs has no generator and
   * its iterations stay stills.
   */
  gen?: string;
}

interface CollectionIterationsProps {
  /** Basename of the JSON under `public/data/collections/`. */
  file: string;
  /** Expected number of iterations, known before the fetch resolves. */
  count: number;
  title: string;
  /**
   * What to call the items when they aren't generative outputs — "photograph"
   * for a photo series, "image" otherwise. A collection backed by a generator
   * overrides this with "iteration", which is what its items literally are:
   * the same program run with a different seed. Seven stills captured from one
   * interactive world are not iterations of anything, and saying so reads as a
   * bug.
   */
  noun?: string;
  /**
   * The shape every item in this collection is shown at.
   *
   * A collection is one body of work, so its items share a shape — the rail
   * uses the same one the grid tile and the stage use, rather than squaring
   * everything off. Pieces whose still was captured square but which are
   * really 16:9 (Causality, Messy Garden) are cropped to match, exactly as
   * the grid tile crops them.
   */
  ratio?: number;
  /** Iteration number currently shown in the main view, if any. */
  selected?: number;
  /**
   * Called when an item is picked, with its number, a full-size still, and
   * whatever richer form the item has: the URL that runs a generative piece
   * live, or the clip behind a still.
   */
  onSelect?: (iteration: number, src: string, extra?: { live?: string; video?: string; ratio?: number }) => void;
}

/**
 * Resolves an entry's image.
 *
 * Three kinds of reference end up here. A bare IPFS CID belongs to an fxhash
 * collection and goes through fxhash's CDN, which resizes and serves WebP. A
 * Cloudinary URL is resized by Cloudinary. Anything else (the Versum, Tomorrow
 * and objkt series) is self-hosted under `/public`, already sized, and used
 * as-is — objkt's CDN offers no resized variants and fxhash's only serves its
 * own CIDs.
 *
 * Without the Cloudinary case a 2000px still was being served into a 64px rail
 * thumbnail, once per item.
 *
 * @param ref - Either an IPFS CID or a path/URL
 * @param w - Requested width, honoured only for CDN-backed images
 */
const thumb = (ref: string, w: number) =>
  isTransformable(ref)
    ? cldUrl(ref, w)
    : ref.startsWith('/') || ref.startsWith('http')
      ? ref
      : `https://media.fxhash.xyz/w_${w}/${ref}`;

/**
 * The URL that runs one iteration live.
 *
 * An fxhash generator is one program; which output it draws is decided entirely
 * by the `fxhash` seed in the query string. So the whole collection is the same
 * CID with a different hash — which is why storing one CID per collection and
 * one hash per iteration is enough to make every one of them playable.
 */
const liveUrl = (data: CollectionData, item: Iteration) =>
  item.e
    ? item.e
    : data.gen && item.h
      ? `https://gateway.fxhash.xyz/ipfs/${data.gen}/?fxhash=${item.h}`
      : undefined;

/** True when the reference can actually be resized by a CDN. */
const resizable = (ref: string) =>
  isTransformable(ref) || !(ref.startsWith('/') || ref.startsWith('http'));

/**
 * What to call the things in a collection, decided by what they actually are.
 *
 * The card's tag is the wrong signal: a "design" card might hold twelve screen
 * recordings, twelve screenshots, or a mix, and calling a set of films "images"
 * is simply wrong. So the items are counted instead.
 *
 * "Iteration" is reserved for a generative token, where it means something
 * precise — the same program run with a different seed. A set that entirely
 * moves is video. A set that entirely sits still keeps whatever the caller
 * knows about it, "photograph" or "image". Anything mixed gets the honest,
 * boring word rather than a wrong specific one.
 */
function itemWord(data: CollectionData, fallback: string): string {
  if (data.gen) return 'iteration';
  const moving = data.items.filter((it) => it.v || it.e).length;
  if (moving === 0) return fallback;
  return moving === data.items.length ? 'video' : 'item';
}

/**
 * Every iteration in a collection, listed down the overlay's information panel.
 *
 * The panel is the place for everything *about* the piece, and which other
 * outputs exist is one of those things — so it sits with the title and the
 * controls rather than taking a strip off the bottom of the stage. The panel
 * scrolls, which is what makes a thousand-item collection survivable.
 *
 * The list is fetched on mount rather than shipped with the page: Chaos alone
 * is 1024 entries, and nobody should pay for that unless they open Chaos. The
 * thumbnails are lazily loaded, so the browser fetches only what scrolls into
 * view — the full set is present in the DOM but costs almost nothing until
 * someone goes looking.
 */
export function CollectionIterations({ file, count, title, noun = 'iteration', ratio = 1, selected, onSelect }: CollectionIterationsProps) {
  const [data, setData] = useState<CollectionData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/data/collections/${file}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json: CollectionData) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [file]);

  if (failed) return null;

  // Clamped through the grid's own helper, so an extreme outlier can't turn a
  // rail thumbnail into a hairline — and so the rail and the tile never
  // disagree about what shape a piece is.
  const shape = displayRatio(ratio);

  const word = data ? itemWord(data, noun) : noun;

  return (
    <section className="mt-8">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {count} {word}{count === 1 ? '' : 's'}
      </h3>

      {!data ? (
        // Reserve exactly the rail's height so the stage above doesn't resize
        // when the list lands.
        <div className="mt-3 h-20 animate-pulse rounded-sm bg-surface" aria-hidden="true" />
      ) : (
        <ul className="mt-3 grid grid-cols-4 gap-1">
          {data.items.map((item) => (
            <li key={item.i}>
              <button
                type="button"
                onClick={() => onSelect?.(item.i, thumb(item.c, 1200), { live: liveUrl(data, item), video: item.v, ratio: item.r })}
                aria-label={`Show ${title} #${item.i}`}
                aria-current={selected === item.i ? 'true' : undefined}
                style={{ aspectRatio: `${shape}` }}
                className={`relative block w-full overflow-hidden rounded-sm bg-surface transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                  selected === item.i ? 'ring-2 ring-ink' : ''
                }`}
              >
              {item.b ? (
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs text-ink-faint font-[family-name:var(--font-mori)]"
                  title={`${title} #${item.i} — no preview captured`}
                >
                  #{item.i}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="absolute inset-0 h-full w-full object-cover"
                  src={thumb(item.c, 300)}
                  srcSet={resizable(item.c) ? `${thumb(item.c, 300)} 300w, ${thumb(item.c, 512)} 512w` : undefined}
                  sizes="80px"
                  alt={`${title} #${item.i}`}
                  loading="lazy"
                  decoding="async"
                />
              )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
