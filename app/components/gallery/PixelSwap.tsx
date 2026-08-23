'use client';

import { useEffect, useMemo, useState } from 'react';
import { containBox } from './stage';

interface PixelSwapProps {
  src: string;
  alt: string;
  /**
   * Width ÷ height to use until the image reports its own. Only a starting
   * shape — every iteration in a collection can differ, so the real ratio is
   * read off each file once it loads rather than inherited from the card.
   */
  ratio?: number;
}

const COLS = 10;
const ROWS = 10;
const TOTAL = COLS * ROWS;
const STEPS = 8;
const STEP_MS = 26;

function shuffled(): number[] {
  const order = Array.from({ length: TOTAL }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Swaps the overlay's main image with the same pixel dissolve the site uses
 * between pages, scoped to this box.
 *
 * The outgoing image stays put until the incoming one has actually decoded, so
 * the frame never goes empty and then repopulates, and the change reads as a
 * deliberate transition rather than a load.
 *
 * The dissolve is driven by one effect keyed on `swap`, an object replaced only
 * when a new transition begins. That matters: an earlier version depended on
 * the "currently painted" value too, so finishing the preload re-ran the effect
 * and its cleanup cancelled the very timers it had just scheduled — the cover
 * stayed up and the image read as a black box.
 */
export function PixelSwap({ src, alt, ratio = 1 }: PixelSwapProps) {
  // What's painted right now — trails `src` until the new file is ready.
  const [shown, setShown] = useState(src);
  // The painted image's true proportions, measured on load.
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  // Replaced wholesale when a swap starts; identity is the effect's trigger.
  const [swap, setSwap] = useState<{ order: number[] } | null>(null);
  const [revealed, setRevealed] = useState(TOTAL);

  const loading = src !== shown;

  const covered = useMemo(() => {
    if (loading) return new Set(Array.from({ length: TOTAL }, (_, i) => i));
    if (!swap || revealed >= TOTAL) return new Set<number>();
    return new Set(swap.order.slice(revealed));
  }, [loading, swap, revealed]);

  // Preload, then paint the new image already fully covered.
  useEffect(() => {
    if (src === shown) return;

    let cancelled = false;
    const img = new Image();
    img.onload = img.onerror = () => {
      if (cancelled) return;
      if (img.naturalWidth && img.naturalHeight) {
        setNaturalRatio(img.naturalWidth / img.naturalHeight);
      }
      setSwap({ order: shuffled() });
      setRevealed(0);
      setShown(src);
    };
    img.src = src;

    return () => { cancelled = true; };
  }, [src, shown]);

  // Lift the cover. Depends only on `swap`, so its own updates can't restart
  // or cancel it.
  useEffect(() => {
    if (!swap) return;

    const perStep = Math.ceil(TOTAL / STEPS);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setRevealed(step * perStep);
      if (step >= STEPS) clearInterval(timer);
    }, STEP_MS);

    return () => clearInterval(timer);
  }, [swap]);

  return (
    <div
      className="relative max-h-full overflow-hidden rounded-sm"
      // Contained against the stage, so a tall iteration is whole rather than
      // running off the bottom. See `containBox`.
      style={containBox(naturalRatio ?? ratio)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={shown}
        alt={alt}
        decoding="async"
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight) {
            setNaturalRatio(el.naturalWidth / el.naturalHeight);
          }
        }}
      />

      {covered.size > 0 && (
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
          aria-hidden="true"
        >
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={covered.has(i) ? 'bg-background' : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
