/**
 * The page shell's geometry, shared by `BlogLayout` and the gallery homepage.
 *
 * Both pages open with the same masthead — name in the left rail, headline in
 * the content column — so the top of the site doesn't shift when you move
 * between them. Keeping the classes here rather than duplicating them means
 * the two can't quietly drift apart again.
 */

/** Outer container: max width, gutters, and the 200px drop to the masthead. */
export const SHELL_CONTAINER =
  'max-w-[1536px] mx-auto pt-0 md:pt-[200px] px-0 md:px-[20px] xl:px-[160px] pb-0 relative z-10';

/**
 * The same container without the top drop — for content that already sits
 * below the masthead, which has taken that space once already.
 */
export const SHELL_CONTAINER_FLUSH =
  'max-w-[1536px] mx-auto pt-0 px-0 md:px-[20px] xl:px-[160px] pb-0 relative z-10';

/** The 12-column bed everything sits on. */
export const SHELL_GRID = 'grid grid-cols-12 gap-4 md:gap-6';

/** Columns 1–2: name and navigation. */
export const SHELL_RAIL = 'col-span-12 md:col-span-2';

/** Columns 4–11: the reading column. */
export const SHELL_CONTENT = 'col-span-12 md:col-span-8';

/**
 * The old six-column measure. Only the markdown editor still needs it, because
 * it puts a panel in the right-hand columns that the wider column would eat.
 */
export const SHELL_CONTENT_NARROW = 'col-span-12 md:col-span-6';

/** A single empty column, used as the gutter between rail and content. */
export const SHELL_SPACER = 'hidden md:block md:col-span-1';

/** Columns 11–12: right margin, or an optional second rail. */
export const SHELL_ASIDE = 'hidden md:block md:col-span-2';
