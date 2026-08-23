'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ScrambleText } from '../ScrambleText';
import { track } from '@/lib/analytics';

/** Query parameter naming the visible body of work, e.g. `/?work=photography`. */
export const WORK_PARAM = 'work';

interface GalleryFilterProps {
  /** Tags present across the manifest, with how many cards carry each. */
  tags: { tag: string; count: number }[];
}

/** "generative art" → "Generative art". */
function label(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/**
 * Switches the grid between bodies of work.
 *
 * Real links carrying the choice in the URL, matching how the blog's tag
 * filter and the piece overlay already work — so a filtered view can be
 * linked to and survives a refresh.
 */
export function GalleryFilter({ tags }: GalleryFilterProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(WORK_PARAM);

  if (tags.length < 2) return null;

  const items = [{ tag: null as string | null, text: 'All' }, ...tags.map((t) => ({ tag: t.tag, text: label(t.tag) }))];

  return (
    <nav className="flex flex-wrap gap-x-6 gap-y-2">
      {items.map(({ tag, text }) => {
        const on = active === tag;
        return (
          <Link
            key={text}
            href={tag ? `${pathname}?${WORK_PARAM}=${encodeURIComponent(tag)}` : pathname}
            scroll={false}
            onClick={() => track('work_filter', { work: tag ?? 'all' })}
            className={`text-base font-semibold transition-colors focus:outline-none ${
              on ? 'text-ink' : 'text-ink-muted hover:text-ink'
            }`}
            aria-current={on ? 'page' : undefined}
          >
            <ScrambleText text={text} />
          </Link>
        );
      })}
    </nav>
  );
}
