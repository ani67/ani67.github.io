/**
 * Canonical route paths, in one place.
 *
 * The tag filter used to build `/?tag=…` inline in three different components,
 * which meant moving the post index was a find-and-replace across the codebase.
 * Everything that links into the blog goes through here instead.
 */
export const ROUTES = {
  home: '/',
  blog: '/blog',
  about: '/about',
} as const;

/**
 * Link to the blog index, optionally filtered by tag.
 *
 * Always points at the blog index rather than the current page: "filter by Art"
 * means *show me the art posts*, which lives at `/blog` no matter where the nav
 * is rendered — a post page, the about page, or the home page.
 *
 * @param tag - Tag to filter by, or null for the unfiltered index
 */
export function blogTagHref(tag: string | null): string {
  return tag ? `${ROUTES.blog}?tag=${encodeURIComponent(tag)}` : ROUTES.blog;
}
