'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { GalleryEntry, GalleryMedia } from '@/lib/gallery';
import { cldSrcSet, cldUrl } from '@/lib/cloudinary';
import { CollectionIterations } from './CollectionIterations';
import { CollectionBoard } from './CollectionBoard';
import { PixelSwap } from './PixelSwap';
import { containBox } from './stage';
import { track, linkTarget } from '@/lib/analytics';

interface GalleryOverlayProps {
  entry: GalleryEntry;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}


/**
 * Full-screen detail view for a gallery entry.
 *
 * Laid out as a tool rather than a document: a fixed-width panel down the left
 * carrying everything textual, and the rest of the screen given over to the
 * work itself, centred and always whole. A tall photograph and a wide video
 * both fit entirely — nothing is cropped and nothing needs scrolling to see.
 *
 * When a piece belongs to a collection, the other items run along the bottom of
 * the stage as a single rail that scrolls sideways. A collection can hold a
 * thousand iterations, and a rail states that honestly while costing one strip
 * of screen; the grid it replaced pushed the work itself out of view.
 *
 * The backdrop is the theme's own background at 60% with a heavy blur
 * (`bg-veil`), so the grid stays faintly legible behind it and the overlay
 * re-tints itself per theme without any extra work.
 */
export function GalleryOverlay({ entry, onClose, onPrev, onNext }: GalleryOverlayProps) {
  // Which iteration of a collection is showing on the stage. Null means the
  // card's own hero. The host keys this component by entry id, so moving to
  // another card remounts and clears the pick — no reset effect needed.
  const [picked, setPicked] = useState<{ i: number; src: string; live?: string; video?: string; ratio?: number } | null>(null);

  const closeRef = useRef<HTMLButtonElement>(null);
  // Where focus was before we opened, so it can be handed back on close.
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [onClose, onPrev, onNext]);

  const board = entry.layout === 'board' && Boolean(entry.collection);
  const linkLabel = entry.hrefLabel ?? (entry.external ? 'Open' : 'View');
  // A solid button rather than an underlined link: this is the one thing in the
  // panel asking to be clicked, and an underline reads as body text that
  // happens to be a link. Inverted against the ink so it carries on any theme.
  const linkClass =
    'inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  const renderMedia = (media: GalleryMedia, key: number) => {
    if (media.type === 'embed') {
      // Falls back to a square, the same assumption the grid's `ratioOf` makes.
      // These two defaults have to agree: when they didn't, a piece with no
      // declared ratio sat square in the grid and then opened as 16:9 with the
      // sketch letterboxed inside it.
      return liveFrame(media.src, media.title ?? entry.title, media.ratio ?? 1, key);
    }

    return renderStill(media, key);
  };

  /**
   * A running piece — the entry's own embed, or one iteration of its collection.
   *
   * Keyed by src so switching iterations remounts the frame rather than swapping
   * the attribute underneath a sketch that is already running. Generative pieces
   * read their seed once at startup, so a reused frame would keep drawing the
   * previous output.
   */
  function liveFrame(src: string, title: string, ratio: number, key: number | string) {
    return (
        // Only mounted while the overlay is open, so the sketch isn't running
        // behind the grid. Opening the overlay is a click, which satisfies the
        // gesture browsers want before letting a piece play its audio.
        <iframe
          key={key}
          style={containBox(ratio)}
          className="max-h-full rounded-sm border-0 bg-surface"
          src={src}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; xr-spatial-tracking"
          // YouTube checks who is embedding it and refuses to play for an
          // anonymous referrer (error 153), so it is sent the origin — the
          // origin only, never the path, which would reveal which piece is
          // open. Sketches hosted elsewhere don't ask, so they stay anonymous.
          referrerPolicy={
            /(^|\.)youtube(-nocookie)?\.com$/.test(new URL(src, 'https://x.invalid').hostname)
              ? 'strict-origin-when-cross-origin'
              : 'no-referrer'
          }
          // Eager, not lazy: this iframe is the thing the visitor just asked
          // to see. A generative piece starts running the moment it loads, so
          // loading it immediately is what makes the focused work autoplay.
          loading="eager"
        />
    );
  }

  /** Everything that isn't running: an image, or a video with controls. */
  function renderStill(media: Exclude<GalleryMedia, { type: 'embed' }>, key: number) {
    if (media.type === 'video') {
      return (
        <video
          key={key}
          className="max-h-full max-w-full rounded-sm object-contain"
          src={media.src}
          poster={media.poster}
          controls
          playsInline
          preload="metadata"
        />
      );
    }

    // A media entry may declare a `ratio` when the work's real proportions
    // differ from whatever fxhash captured — the square previews of 16:9
    // pieces, for instance. On the stage that ratio governs the box while
    // `object-cover` trims the capture to it; without one the file speaks for
    // itself and is simply contained.
    if (media.ratio) {
      return (
        <div key={key} style={containBox(media.ratio)} className="max-h-full overflow-hidden rounded-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-full w-full object-cover"
            src={cldUrl(media.src, 1600)}
            srcSet={cldSrcSet(media.src)}
            sizes="70vw"
            alt={media.alt ?? entry.title}
            decoding="async"
          />
        </div>
      );
    }

    return (
      // No declared ratio, so the file speaks for itself. It still fills the
      // stage rather than sitting at whatever pixel size it happens to be:
      // `max-*` alone caps a large image but leaves a small one small, which
      // made the same piece open at one size and then jump to another once an
      // iteration was picked, since that path always filled.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={key}
        className="h-full w-full rounded-sm object-contain"
        src={cldUrl(media.src, 1600)}
        srcSet={cldSrcSet(media.src)}
        sizes="70vw"
        alt={media.alt ?? entry.title}
        decoding="async"
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-veil backdrop-blur-2xl overscroll-contain md:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
    >
      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close"
        // No ground of its own at rest — the overlay behind it is already veiled
        // and blurred, so a second layer only drew a disc around the cross. The
        // ground appears on hover, where it marks the target.
        className="absolute top-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* The panel. Fixed width, so the stage beside it is the only thing that
          changes size with the viewport and the reading measure stays put. */}
      <aside className="w-full shrink-0 overflow-y-auto border-b border-hairline-subtle px-6 py-8 md:w-[360px] md:border-r md:border-b-0 md:px-8 md:py-10">
        <h2 className="pr-12 text-2xl font-semibold leading-snug text-ink md:pr-0 md:text-3xl">
          {entry.title}
        </h2>

        {(entry.year || entry.medium) && (
          <p className="mt-3 text-sm font-semibold text-ink-subtle">
            {[entry.medium, entry.year].filter(Boolean).join(' · ')}
          </p>
        )}

        {entry.venue && <p className="mt-1 text-sm text-ink-faint">{entry.venue}</p>}

        {entry.blurb && <p className="mt-6 text-base leading-relaxed text-ink-muted">{entry.blurb}</p>}

        {entry.href && (
          <div className="mt-8">
            {/* The CTA is the only place a visitor can leave for the work
                itself, so a click here is the strongest signal the gallery
                produces — it separates looking from following through. */}
            {entry.external ? (
              <a
                href={entry.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                onClick={() => track('outbound_click', {
                  piece_id: entry.id,
                  destination: linkTarget(entry.href!),
                  label: linkLabel,
                })}
              >
                {linkLabel} ↗
              </a>
            ) : (
              <Link
                href={entry.href}
                className={linkClass}
                onClick={() => track('outbound_click', {
                  piece_id: entry.id,
                  destination: 'internal',
                  label: linkLabel,
                })}
              >
                {linkLabel} →
              </Link>
            )}
          </div>
        )}

        {/* How to drive it, kept apart from what it is. The artist's fxhash
            notes run the two together; a reader wanting to know what a key does
            shouldn't have to read a paragraph about the work to find out. */}
        {entry.controls && entry.controls.length > 0 && (
          <div className="mt-8">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Controls
            </h3>
            <ul className="mt-3 space-y-1.5">
              {entry.controls.map((line) => {
                // Split on the em dash so the trigger can carry the emphasis
                // and the whole column of them lines up.
                const [trigger, ...rest] = line.split(' — ');
                return (
                  <li key={line} className="text-sm leading-relaxed text-ink-muted">
                    <span className="text-ink">{trigger}</span>
                    {rest.length > 0 && <> — {rest.join(' — ')}</>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {entry.caution && (
          <p className="mt-4 text-sm leading-relaxed text-ink-faint">{entry.caution}</p>
        )}



        {entry.collection && !board && (
          <CollectionIterations
            file={entry.collection.file}
            count={entry.collection.count}
            title={entry.title}
            ratio={entry.media[0]?.ratio ?? 1}
            noun={entry.tags.includes('photography') ? 'photograph' : 'image'}
            selected={picked?.i}
            onSelect={(i, src, extra) => setPicked({ i, src, ...extra })}
          />
        )}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* The stage. `container-type: size` is what lets `containBox` measure
            against it; `min-h-0` is what stops a flex child from refusing to
            shrink below its content and pushing the rail off-screen. */}
        {board ? (
          // No padding and no centring: the board is meant to run edge to edge
          // and be scrolled, not fitted into the viewport like a single piece.
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <CollectionBoard file={entry.collection!.file} title={entry.title} />
          </div>
        ) : (
        <div
          className="flex min-h-[45vh] flex-1 items-center justify-center p-4 md:min-h-0 md:p-8"
          style={{ containerType: 'size' }}
          // The margin around the work is backdrop: clicking it closes, the
          // same as clicking outside a smaller modal would. Only a click that
          // lands on the stage itself counts — one that lands on the work has
          // a different target and passes through untouched.
          //
          // Flex, not grid, and the media is a direct child. A percentage
          // `max-height` only resolves against a containing block of definite
          // height: an auto-height wrapper has none, and a centred grid's row
          // is auto-sized, so it grows to the image and `max-h-full` then
          // measures against the image itself. Both let a square image run
          // past the bottom edge. A flex container's height is definite, so
          // `max-h-full` finally means what it says.
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {picked?.video ? (
            // A moving item plays where its still would have been.
            <video
              key={picked.video}
              className="max-h-full max-w-full rounded-sm object-contain"
              src={picked.video}
              poster={picked.src}
              controls
              autoPlay
              playsInline
            />
          ) : picked?.live ? (
            // The picked iteration, running — not a snapshot of it.
            liveFrame(picked.live, `${entry.title} #${picked.i}`, picked.ratio ?? entry.media[0]?.ratio ?? 1, picked.live)
          ) : picked ? (
            <PixelSwap
              src={picked.src}
              alt={`${entry.title} #${picked.i}`}
              ratio={entry.media[0]?.ratio ?? 1}
            />
          ) : entry.media.length > 0 ? (
            renderMedia(entry.media[0], 0)
          ) : (
            <div className="flex aspect-[4/3] w-full max-w-md items-center justify-center rounded-sm bg-surface">
              <span className="text-ink-faint">No images yet</span>
            </div>
          )}
        </div>
        )}

      </section>
    </div>
  );
}
