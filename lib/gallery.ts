import fs from 'fs';
import path from 'path';
import { cache } from 'react';
import { z } from 'zod';
import { getPostBySlug } from './posts';

/**
 * The gallery manifest lives in JSON rather than TypeScript so the in-page
 * editor (dev only, see `app/api/gallery`) can rewrite it safely. Types come
 * from the zod schema below instead of from the literal, so a hand-edit that
 * goes wrong fails loudly at build rather than rendering a broken tile.
 *
 * Order in the file is order on the page — it's editorial, so nothing here
 * sorts it.
 *
 * Authoring notes:
 * - `post` inherits title, blurb, cover image and href from a blog post, so a
 *   case study isn't described twice. Anything set explicitly wins.
 * - `media` may be empty. Those entries render as typographic tiles, which
 *   lets a piece be listed before its images exist.
 * - The first `media` item is the grid thumbnail.
 * - Cloudinary URLs are resized automatically (see `lib/cloudinary.ts`). Local
 *   files under `/public` are served as-is, so put a sensibly sized file there.
 */
export const manifestPath = path.join(process.cwd(), 'content/gallery.json');

/**
 * Width ÷ height of the artwork. The grid lays tiles out at their true
 * proportions rather than cropping everything square, so this travels with the
 * media. Defaults to 1 when absent.
 */
const ratio = z.number().positive().optional();

const GalleryMediaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), src: z.string().min(1), alt: z.string().optional(), ratio }),
  z.object({ type: z.literal('video'), src: z.string().min(1), poster: z.string().optional(), ratio }),
  // A live program in an iframe — an fxhash token, a Cables sketch, anything
  // self-contained. `poster` is what the grid shows, because thirty running
  // sketches would melt the page; the iframe only mounts once the overlay is
  // open, which is also the user gesture browsers require before audio plays.
  z.object({ type: z.literal('embed'), src: z.string().min(1), poster: z.string().optional(), title: z.string().optional(), ratio }),
]);

const GalleryEntryInputSchema = z.object({
  id: z.string().min(1, 'id is required'),
  post: z.string().optional(),
  title: z.string().optional(),
  year: z.string().optional(),
  medium: z.string().optional(),
  venue: z.string().optional(),
  blurb: z.string().optional(),
  href: z.string().optional(),
  hrefLabel: z.string().optional(),
  external: z.boolean().optional(),
  /** Groups a card into a body of work — "generative art", "photography". */
  tags: z.array(z.string()).optional(),
  /**
   * How to drive an interactive piece, one line each, normalised to
   * `trigger — what it does`. Taken from the artist's own fxhash notes, which
   * mix the statement about the work and the instructions for using it into a
   * single block of prose; the two do different jobs and are split apart here.
   */
  controls: z.array(z.string()).optional(),
  /** A warning worth reading before pressing anything — heavy load, flashing. */
  caution: z.string().optional(),
  /**
   * Keeps a card out of the grid without deleting it.
   *
   * For work that is catalogued but not ready to be shown — the entry, its
   * media and its collection all stay put, and `/?piece=<id>` still opens it,
   * so a link can be shared while the tile stays off the homepage.
   */
  hidden: z.boolean().optional(),
  /**
   * How the overlay presents the piece.
   *
   * `board` is for work that was composed as one long scroll — the two Behance
   * projects — where the join between images is part of the layout. It fills
   * the stage width and drops the rail; everything else keeps the default of a
   * single contained piece with its collection beside it.
   */
  layout: z.enum(['board']).optional(),
  media: z.array(GalleryMediaSchema).optional(),
  // Marks a card as standing for a whole series. `file` names a JSON under
  // `public/data/collections/`, listing every iteration; the overlay fetches it
  // on open so a 1024-piece collection costs nothing until someone asks for it.
  collection: z.object({
    file: z.string().min(1),
    count: z.number().int().nonnegative(),
  }).optional(),
});

export const GalleryManifestSchema = z.array(GalleryEntryInputSchema);

/** A single piece of media in an entry. The first one is the grid thumbnail. */
export type GalleryMedia = z.infer<typeof GalleryMediaSchema>;

/** An entry as authored in `content/gallery.json`. */
export type GalleryEntryInput = z.infer<typeof GalleryEntryInputSchema>;

/**
 * What an entry looks like once resolved — every field the UI needs, with the
 * `post` indirection already collapsed.
 */
export interface GalleryEntry {
  id: string;
  title: string;
  /** Year or range, e.g. "2021". Shown beside the title in the overlay. */
  year?: string;
  /** What kind of thing it is: "Generative art", "Web audio", "Product design". */
  medium?: string;
  /** Where it was shown, if anywhere. */
  venue?: string;
  /** Short description for the overlay. Entries without one show no prose. */
  blurb?: string;
  /** Where to go to see the real thing. */
  href?: string;
  /** Call-to-action label. Defaults based on whether the link leaves the site. */
  hrefLabel?: string;
  /** True for `href`s that leave the site, so links get target/rel treatment. */
  external?: boolean;
  /** Bodies of work this card belongs to, used by the homepage filter. */
  tags: string[];
  /** How to drive an interactive piece, `trigger — what it does` per line. */
  controls?: string[];
  /** A warning worth reading before pressing anything. */
  caution?: string;
  /** True for a card catalogued but deliberately kept out of the grid. */
  hidden?: boolean;
  /** `board` renders the collection as one full-width scroll. */
  layout?: 'board';
  media: GalleryMedia[];
  /** Present when this card stands for a series; the overlay lists the rest. */
  collection?: { file: string; count: number };
}

/**
 * Reads the manifest off disk.
 *
 * Read rather than imported so the dev editor's writes show up on the next
 * render without a module-cache bust. `cache()` keeps it to one read per pass.
 */
export const readManifest = cache((): GalleryEntryInput[] => {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return GalleryManifestSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error('Error reading gallery manifest:', error);
    return [];
  }
});

/**
 * Resolves the manifest into entries the UI can render.
 *
 * Server-only: following a `post` reference reads from disk.
 */
export function getGallery(): GalleryEntry[] {
  return readManifest().map((entry) => resolveEntry(entry));
}

function resolveEntry(input: GalleryEntryInput): GalleryEntry {
  const post = input.post ? getPostBySlug(input.post) : null;

  // A post reference contributes a cover only if the post actually has one —
  // several don't, and a missing cover should fall through to the typographic
  // tile rather than render a broken image.
  const postMedia: GalleryMedia[] =
    post?.image ? [{ type: 'image', src: post.image, alt: post.title }] : [];

  const href = input.href ?? (post ? `/posts/${post.slug}/` : undefined);
  const media = input.media?.length ? input.media : postMedia;

  return {
    id: input.id,
    title: input.title ?? post?.title ?? input.id,
    year: input.year ?? (post ? post.date.slice(0, 4) : undefined),
    medium: input.medium,
    venue: input.venue,
    blurb: input.blurb ?? post?.description,
    href,
    hrefLabel: input.hrefLabel,
    external: input.external ?? (href ? isExternal(href) : false),
    tags: input.tags ?? [],
    controls: input.controls,
    caution: input.caution,
    hidden: input.hidden,
    layout: input.layout,
    media,
    collection: input.collection,
  };
}

function isExternal(href: string): boolean {
  // Treat the two hand-built static pages as external too: they sit outside
  // the Next router, so they need a plain <a> rather than a <Link>.
  return (
    href.startsWith('http') ||
    href.endsWith('.html') ||
    href.startsWith('/thegiftofpoetry')
  );
}
