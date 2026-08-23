/**
 * Cloudinary URL transforms.
 *
 * Every cover image on the site is a raw Cloudinary URL pointing at the
 * full-size original — fine when a page showed one or two, a problem for a
 * grid of thumbnails. Cloudinary applies transforms as a path segment, so
 * resizing costs nothing but string manipulation: no build step, no proxy,
 * no `next/image` loader.
 *
 * Anything that isn't a Cloudinary upload URL (local files under `/public`,
 * other hosts) passes through untouched.
 */

/** Splits a Cloudinary upload URL into its prefix and the part after `/upload/`. */
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Widths offered to the browser. Covers a 2-up phone grid to a 4-up 4K grid. */
const DEFAULT_WIDTHS = [400, 600, 800, 1200, 1600] as const;

/**
 * Rewrites a Cloudinary URL to request a specific width.
 *
 * `f_auto` negotiates AVIF/WebP per browser and `q_auto` picks a quality that
 * suits the image's content, which together account for most of the saving.
 *
 * @param src - Image URL
 * @param width - Desired width in pixels
 */
export function cldUrl(src: string, width: number): string {
  const match = src.match(CLOUDINARY_UPLOAD);
  if (!match) return src;

  const [, prefix, rest] = match;
  return `${prefix}f_auto,q_auto,w_${width}/${rest}`;
}

/**
 * Builds a `srcset` so the browser can pick a width for its viewport and DPR.
 *
 * @param src - Image URL
 * @param widths - Widths to offer
 * @returns A srcset string, or undefined if the URL isn't transformable
 */
export function cldSrcSet(src: string, widths: readonly number[] = DEFAULT_WIDTHS): string | undefined {
  if (!CLOUDINARY_UPLOAD.test(src)) return undefined;
  return widths.map((w) => `${cldUrl(src, w)} ${w}w`).join(', ');
}

/** Widths for square grid thumbnails. A tile is ~370px at most, so 800 covers 2× DPR. */
const THUMB_WIDTHS = [300, 400, 600, 800] as const;

/**
 * Rewrites a Cloudinary URL to a square, edge-to-edge thumbnail.
 *
 * Several covers are UI screenshots exported with transparent padding baked
 * in. Left alone they letterbox inside a square tile — `object-fit: cover`
 * dutifully fills the box with an image that is itself mostly margin. So:
 *
 *   e_trim  strips the uniform border first
 *   c_fill  crops to fill rather than fitting inside
 *   ar_<r>  matches the tile's own shape
 *   g_auto  keeps the interesting part when cropping
 *
 * The aspect ratio has to be passed in. It used to be hard-coded to 1:1, from
 * when every tile was square; once tiles took their piece's real proportions
 * that crop happened *before* `object-fit: cover` cropped again, so a 2:1
 * drawing was cut to a square and then blown up to fill a wide tile.
 *
 * Only for grid tiles. The overlay shows the whole image uncropped.
 *
 * @param src - Image URL
 * @param width - Desired square edge in pixels
 */
export function cldThumb(src: string, width: number, ratio = 1): string {
  const match = src.match(CLOUDINARY_UPLOAD);
  if (!match) return src;

  const [, prefix, rest] = match;
  const ar = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return `${prefix}e_trim/c_fill,ar_${ar},g_auto,f_auto,q_auto,w_${width}/${rest}`;
}

/**
 * `srcset` of square thumbnails.
 *
 * @param src - Image URL
 * @returns A srcset string, or undefined if the URL isn't transformable
 */
export function cldThumbSrcSet(src: string, ratio = 1, widths: readonly number[] = THUMB_WIDTHS): string | undefined {
  if (!CLOUDINARY_UPLOAD.test(src)) return undefined;
  return widths.map((w) => `${cldThumb(src, w, ratio)} ${w}w`).join(', ');
}

/** True when the URL can be resized — useful for deciding whether to bother. */
export function isTransformable(src: string): boolean {
  return CLOUDINARY_UPLOAD.test(src);
}
