/**
 * Custom events, on top of the `page_view` GA4 sends by itself.
 *
 * The gallery keeps its state in the query string — `?piece=chaos`,
 * `?work=photography` — and a page view is measured by path, so without these
 * every card, filter and overlay on the homepage reports as one hit for `/`.
 * These are the events that make the difference visible.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Sends an event if analytics is actually there.
 *
 * Silent when it isn't — during server rendering, before the GA script loads,
 * or when a blocker has removed it. Analytics failing must never take a click
 * with it, so nothing here throws and no caller has to check first.
 */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}

/** Which host a CTA points at, so outbound clicks group by destination. */
export function linkTarget(href: string): string {
  if (!href.startsWith('http')) return 'internal';
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
