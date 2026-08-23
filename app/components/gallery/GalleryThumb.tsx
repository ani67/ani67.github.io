import type { GalleryMedia } from '@/lib/gallery';
import { cldThumb, cldThumbSrcSet } from '@/lib/cloudinary';

interface GalleryThumbProps {
  media: GalleryMedia | undefined;
  title: string;
  /** Roughly how wide the tile renders, for `sizes`. Tracks the grid's columns. */
  sizes?: string;
  /** The first row is above the fold; everything else can wait. */
  priority?: boolean;
}

/**
 * The image (or video) inside a grid tile.
 *
 * Entries without media fall back to a typographic tile rather than a broken
 * or placeholder image — a piece can be catalogued before its assets exist.
 */
export function GalleryThumb({ media, title, sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw', priority }: GalleryThumbProps) {
  // An embed shows its poster in the grid — the live version is the overlay's
  // job. Without a poster it falls through to the typographic tile rather than
  // running a sketch in a thumbnail.
  const still = media?.type === 'embed'
    ? (media.poster ? { type: 'image' as const, src: media.poster, alt: title, ratio: media.ratio } : undefined)
    : media;
  // The tile is cut to the piece's own shape, so Cloudinary must crop to that
  // shape too — otherwise it crops to a square first and the tile crops again.
  const shape = still?.ratio ?? 1;

  if (!still) {
    return (
      <div className="absolute inset-0 flex items-end bg-surface p-4">
        <span className="text-ink-subtle text-sm font-[family-name:var(--font-mori)] uppercase tracking-wide">
          {title}
        </span>
      </div>
    );
  }

  if (still.type === 'video') {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={still.src}
        poster={still.poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title}
      />
    );
  }

  return (
    // Plain <img> on purpose: `images.unoptimized` is set for the static
    // export, so next/image would add a wrapper and no optimisation. Cloudinary
    // does the resizing here instead, via srcSet above.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="absolute inset-0 h-full w-full object-cover"
      src={cldThumb(still.src, 600, shape)}
      srcSet={cldThumbSrcSet(still.src, shape)}
      sizes={sizes}
      alt={still.alt ?? title}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
