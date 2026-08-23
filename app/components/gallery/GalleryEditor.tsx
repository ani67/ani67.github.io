'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GalleryEntry, GalleryEntryInput, GalleryMedia } from '@/lib/gallery';
import { GalleryThumb } from './GalleryThumb';
import { GalleryEntryForm } from './GalleryEntryForm';
import { GRID_CLASS, TILE_CLASS, tileStyle, fillerStyles } from './grid-style';

interface GalleryEditorProps {
  /** Raw manifest entries, in page order. */
  manifest: GalleryEntryInput[];
  /** The same entries resolved by the server, for thumbnails and titles. */
  entries: GalleryEntry[];
}

/**
 * In-place editing of the gallery, on the gallery itself. Development only.
 *
 * Every change writes `content/gallery.json` immediately and re-renders from
 * the server — there's no save button and no draft state, so what you're
 * looking at is always what the file says. Publishing is still a git commit;
 * this only edits the source.
 */
export function GalleryEditor({ manifest, entries }: GalleryEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState<GalleryEntryInput[]>(manifest);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [formIndex, setFormIndex] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Thumbnails come from the server's resolved entries where possible, so
  // `post`-backed covers still show. Locally added items fall back to their
  // own media until the next refresh.
  const resolvedById = useMemo(() => {
    const map = new Map<string, GalleryEntry>();
    entries.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [entries]);

  const persist = useCallback(async (next: GalleryEntryInput[]) => {
    setItems(next);
    setSaving(true);
    setError(null);

    try {
      // Trailing slash on purpose: `trailingSlash: true` in next.config would
      // otherwise 308 this and cost an extra round trip on every save.
      const res = await fetch('/api/gallery/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `Save failed (${res.status})`);
      }

      router.refresh();
    } catch (e) {
      // Put the file's version back on screen rather than leaving the UI
      // showing a change that never made it to disk.
      setError(e instanceof Error ? e.message : 'Save failed');
      setItems(manifest);
    } finally {
      setSaving(false);
    }
  }, [manifest, router]);

  const move = (from: number, to: number) => {
    if (from === to) return;
    setItems((current) => {
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const remove = (index: number) => {
    setConfirmIndex(null);
    persist(items.filter((_, i) => i !== index));
  };

  const submitEntry = (entry: GalleryEntryInput) => {
    const next = items.slice();
    if (formIndex !== null) next[formIndex] = entry;
    else next.push(entry);

    setFormIndex(null);
    setCreating(false);
    persist(next);
  };

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[1536px] flex-wrap items-center gap-4 px-6 md:px-[20px] xl:px-[160px]">
        <p className="text-sm text-ink-muted font-[family-name:var(--font-mori)]">
          Drag to reorder · click a tile to edit · saves to content/gallery.json
        </p>
        {saving && <span className="text-sm text-ink-faint">Saving…</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      <ul className={GRID_CLASS}>
        {/* Add sits first, so creating a piece doesn't mean scrolling to the
            end of the grid. New entries are appended and can be dragged up. */}
        <li style={tileStyle()}>
          <button
            onClick={() => setCreating(true)}
            aria-label="Add a piece"
            className={`${TILE_CLASS} flex items-center justify-center border border-dashed border-hairline-strong bg-transparent text-ink-muted hover:text-ink hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
          >
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </li>

        {items.map((item, i) => {
          const resolved = resolvedById.get(item.id);
          const media: GalleryMedia | undefined = item.media?.[0] ?? resolved?.media[0];
          const title = item.title ?? resolved?.title ?? item.id;

          return (
            <li
              key={item.id}
              style={tileStyle()}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnter={() => { if (dragIndex !== null && dragIndex !== i) { move(dragIndex, i); setDragIndex(i); } }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => { setDragIndex(null); persist(items); }}
              className={dragIndex === i ? 'opacity-40' : undefined}
            >
              <div className={`${TILE_CLASS} cursor-grab active:cursor-grabbing`}>
                <GalleryThumb media={media} title={title} priority={i < 5} />

                {/* Edit affordances, revealed on hover over a scrim. */}
                <div className="absolute inset-0 bg-scrim opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    onClick={() => setFormIndex(i)}
                    aria-label={`Edit ${title}`}
                    className="absolute inset-0 flex items-center justify-center focus:outline-none"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-veil backdrop-blur-2xl text-white">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
                      </svg>
                    </span>
                  </button>

                  <button
                    onClick={() => setConfirmIndex(i)}
                    aria-label={`Delete ${title}`}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-veil backdrop-blur-2xl text-white hover:bg-red-500/70 focus:outline-none"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Delete confirmation, in place rather than a browser dialog. */}
                {confirmIndex === i && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-veil backdrop-blur-2xl p-3 text-center">
                    <p className="text-sm text-ink">Delete “{title}”?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => remove(i)}
                        className="rounded-full bg-red-500/80 px-3 py-1 text-sm text-white hover:bg-red-500 focus:outline-none"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmIndex(null)}
                        className="rounded-full bg-surface-hover px-3 py-1 text-sm text-ink hover:bg-surface focus:outline-none"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}

        {/* Absorb the last row's leftover width so it isn't stretched. */}
        {fillerStyles().map((style, i) => (
          <li key={`filler-${i}`} style={style} aria-hidden="true" />
        ))}
      </ul>

      {(formIndex !== null || creating) && (
        <GalleryEntryForm
          entry={formIndex !== null ? items[formIndex] : null}
          resolved={formIndex !== null ? resolvedById.get(items[formIndex].id) : undefined}
          existingIds={items.filter((_, i) => i !== formIndex).map((e) => e.id)}
          onSubmit={submitEntry}
          onCancel={() => { setFormIndex(null); setCreating(false); }}
        />
      )}
    </>
  );
}
