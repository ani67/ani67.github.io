'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { ScrambleText } from '../ScrambleText';

/**
 * The masthead's three destinations, behaving as tabs.
 *
 * All three share one treatment — the name is the first tab, not a heading
 * above the others — and the highlight marks where you are rather than always
 * sitting on the name. Landing on /blog highlights Writings; the name goes
 * muted like any other tab you are not currently on.
 */
const TABS = [
  { label: 'Ani Dalal', href: ROUTES.home },
  { label: 'Writings', href: ROUTES.blog },
  { label: 'About', href: ROUTES.about },
];

/**
 * Which tab owns the current path.
 *
 * Home has to match exactly, since every path starts with `/`. Writings also
 * claims the individual post pages: they live under `/posts/`, but a post is
 * something you reached through Writings, and leaving the row unlit while
 * reading one would suggest you had left the section.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === '/' || pathname === '';
  if (href === ROUTES.blog) return pathname.startsWith(ROUTES.blog) || pathname.startsWith('/posts');
  return pathname.startsWith(href);
}

export function MastheadNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
      {TABS.map(({ label, href }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={`text-base font-semibold transition-colors focus:outline-none ${
              current ? 'text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <ScrambleText text={label} />
          </Link>
        );
      })}
    </nav>
  );
}
