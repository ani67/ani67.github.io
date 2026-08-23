'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ScrambleText } from './ScrambleText';
import { blogTagHref } from '@/lib/routes';

const TAGS: { label: string; tag: string | null }[] = [
  { label: 'All', tag: null },
  { label: 'Work', tag: 'work' },
  { label: 'Art', tag: 'art' },
  { label: 'Vibes', tag: 'vibes' },
];

/**
 * The blog's tag filter as a single horizontal row, sitting under the
 * headline. It used to live in the left rail; the rail is gone, and a row of
 * four words reads better across the top than stacked down the side.
 *
 * Real links rather than buttons, so they work before hydration and can be
 * opened in a new tab.
 */
export function TagFilterBar() {
  const searchParams = useSearchParams();
  const selected = searchParams.get('tag');

  return (
    <nav className="flex flex-wrap gap-x-6 gap-y-2">
      {TAGS.map(({ label, tag }) => {
        const active = selected === tag;
        return (
          <Link
            key={label}
            href={blogTagHref(tag)}
            className={`text-base font-semibold transition-colors focus:outline-none ${
              active ? 'text-ink' : 'text-ink-muted hover:text-ink'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <ScrambleText text={label} />
          </Link>
        );
      })}
    </nav>
  );
}
