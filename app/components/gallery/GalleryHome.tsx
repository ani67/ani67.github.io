import { Suspense } from 'react';
import { getGallery, readManifest } from '@/lib/gallery';
import { Masthead } from '../layout/Masthead';
import { GalleryGrid } from './GalleryGrid';
import { GalleryOverlayHost } from './GalleryOverlayHost';
import { GallerySurface } from './GallerySurface';
import { EditToggle } from './EditToggle';
import { GalleryFilter } from './GalleryFilter';
import { Headline } from '../layout/headline';

/**
 * The year a card sorts by.
 *
 * Years are written either plainly ("2022") or as a range ("2013–2018"),
 * and a range sorts by its later year: that is when the work finished, which
 * is what "newest first" means to someone reading down the page. Anything
 * unparseable sinks to the bottom rather than jumping to the top.
 */
function latestYear(year?: string): number {
  const found = (year ?? '').match(/\d{4}/g);
  return found ? Math.max(...found.map(Number)) : 0;
}

/**
 * The gallery homepage.
 *
 * Shares `Masthead` with /blog, /about and the post pages, so the top of the
 * page is identical wherever you land. Only the grid below is particular to
 * this route — and it runs full bleed, which is why this can't simply use
 * `BlogLayout` (that pins its children to the reading column).
 */
export function GalleryHome() {
  const all = getGallery();
  // Hidden cards stay in the manifest and stay reachable by URL; they just
  // don't take a tile or count towards a filter.
  //
  // Newest first, and ties keep their manifest order — twenty pieces share
  // 2022, so without a stable second key the grid would reshuffle those on
  // every build for no reason.
  const entries = all
    .filter((e) => !e.hidden)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => latestYear(b.entry.year) - latestYear(a.entry.year) || a.index - b.index)
    .map(({ entry }) => entry);
  // Editing writes to the filesystem, so it only exists while running locally.
  // In a production build this is false, the button is never rendered, and the
  // editor chunk is never requested.
  const canEdit = process.env.NODE_ENV === 'development';
  const manifest = canEdit ? readManifest() : [];

  // Bodies of work, ordered by how much there is of each.
  const counts = new Map<string, number>();
  entries.forEach((e) => e.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="min-h-screen text-ink relative z-10">
      <a
        href="#gallery"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface focus:text-ink focus:rounded focus:outline-none"
      >
        Skip to the work
      </a>

      <Masthead
        headline={<Headline />}
        below={
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Suspense><GalleryFilter tags={tags} /></Suspense>
            {canEdit && <Suspense><EditToggle /></Suspense>}
          </div>
        }
      />

      {/* Edge to edge: the grid deliberately escapes the masthead's container. */}
      <main id="gallery" className="pt-16 pb-24 md:pt-32">
        <h2 className="sr-only">Selected work</h2>
        <Suspense fallback={<GalleryGrid entries={entries} />}>
          <GallerySurface
            view={<GalleryGrid entries={entries} />}
            filtered={Object.fromEntries(
              tags.map(({ tag }) => [
                tag,
                <GalleryGrid key={tag} entries={entries.filter((e) => e.tags.includes(tag))} />,
              ])
            )}
            manifest={manifest}
            entries={entries}
            canEdit={canEdit}
          />
        </Suspense>
      </main>

      {/* Reads `?piece=` from the URL, so it needs a Suspense boundary to stay
          compatible with the static export. */}
      <Suspense>
        <GalleryOverlayHost entries={all} />
      </Suspense>
    </div>
  );
}
