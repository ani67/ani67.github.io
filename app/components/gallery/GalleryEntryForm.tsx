'use client';

import { useEffect, useRef, useState } from 'react';
import type { GalleryEntry, GalleryEntryInput, GalleryMedia } from '@/lib/gallery';

interface GalleryEntryFormProps {
  /** The entry being edited, or null when creating a new one. */
  entry: GalleryEntryInput | null;
  /** Its resolved form, used for placeholders where a value is inherited. */
  resolved?: GalleryEntry;
  /** Ids already in use, so a generated id can avoid colliding. */
  existingIds: string[];
  onSubmit: (entry: GalleryEntryInput) => void;
  onCancel: () => void;
}

/** Turns a name into a usable id: "The Gift of Poetry" → "the-gift-of-poetry". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Appends -2, -3… until the slug is free. */
function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Anything ending in a video extension becomes a video rather than an image. */
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

const FIELD =
  'w-full rounded-sm bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';
const LABEL =
  'block text-xs uppercase tracking-wide text-ink-faint mb-1.5 font-[family-name:var(--font-mori)]';

/**
 * Edits one gallery entry, floating directly on the blurred backdrop.
 *
 * Four fields, deliberately: a name, what to show, what to say, and where it
 * goes. Everything else an entry can carry — year, medium, venue, the `post`
 * inheritance, the link label — is set by hand in the JSON when it's wanted.
 * Saving merges over the original entry rather than replacing it, so those
 * values survive an edit made here.
 */
export function GalleryEntryForm({ entry, resolved, existingIds, onSubmit, onCancel }: GalleryEntryFormProps) {
  const [name, setName] = useState(entry?.title ?? '');
  const [mediaText, setMediaText] = useState((entry?.media ?? []).map((m) => m.src).join('\n'));
  const [blurb, setBlurb] = useState(entry?.blurb ?? '');
  const [href, setHref] = useState(entry?.href ?? '');

  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstFieldRef.current?.focus(); }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  // A new piece needs a name to derive its id from; an existing one already
  // has an id, so its name may be left inherited from a post.
  const valid = Boolean(entry) || name.trim() !== '';

  const submit = () => {
    if (!valid) return;

    // Rebuild media from the URL list, preserving the original entry's type
    // and extra fields wherever a URL is unchanged, and inferring video from
    // the file extension for new ones.
    const previous = new Map((entry?.media ?? []).map((m) => [m.src, m]));
    const media: GalleryMedia[] = mediaText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((src) =>
        previous.get(src) ??
        (VIDEO_EXTENSIONS.test(src)
          ? { type: 'video' as const, src }
          : { type: 'image' as const, src })
      );

    const trimmed = (value: string) => (value.trim() === '' ? undefined : value.trim());

    // Merge over the original so fields this form doesn't show — year, medium,
    // venue, post, hrefLabel — are carried through untouched.
    onSubmit({
      ...entry,
      id: entry?.id ?? uniqueId(slugify(name), existingIds),
      title: trimmed(name),
      blurb: trimmed(blurb),
      href: trimmed(href),
      media,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-veil backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={entry ? `Edit ${resolved?.title ?? entry.id}` : 'Add a piece'}
      onClick={onCancel}
    >
      {/* No card: the fields float straight on the blur. */}
      <div
        className="mx-auto my-16 w-full max-w-xl px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="gf-name">Name</label>
            <input
              ref={firstFieldRef}
              id="gf-name"
              className={`${FIELD} text-2xl font-[family-name:var(--font-mondwest)]`}
              value={name}
              placeholder={resolved?.title ?? 'Name'}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="gf-media">Image or video — one URL per line, first is the thumbnail</label>
            <textarea
              id="gf-media"
              className={`${FIELD} min-h-20 font-mono text-sm`}
              value={mediaText}
              placeholder={'https://res.cloudinary.com/…'}
              onChange={(e) => setMediaText(e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="gf-blurb">Description</label>
            <textarea
              id="gf-blurb"
              className={`${FIELD} min-h-24`}
              value={blurb}
              placeholder={resolved?.blurb ?? 'A sentence or two, shown in the overlay.'}
              onChange={(e) => setBlurb(e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="gf-href">Link — optional</label>
            <input
              id="gf-href"
              className={FIELD}
              value={href}
              placeholder={resolved?.href ?? '/instrument'}
              onChange={(e) => setHref(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={submit}
            disabled={!valid}
            className="rounded-full bg-ink px-5 py-2 text-background transition-opacity hover:opacity-90 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            {entry ? 'Save' : 'Add'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-full bg-surface-hover px-5 py-2 text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
