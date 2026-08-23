import Link from 'next/link';
import { ScrambleText } from '../ScrambleText';
import { ThemeToggle } from './ThemeToggle';
import { blogTagHref } from '@/lib/routes';

interface NavigationLinksProps {
  selectedTag: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
  listClassName?: string;
  itemClassName?: string;
  inactiveClassName?: string;
}

/**
 * Main navigation links — order is Tools → Filter → About/Theme. Tools at the
 * top because they're the highest-signal entries on the rail; filter and
 * about live below.
 */
export function NavigationLinks({
  selectedTag, onTagSelect, useLinks,
  listClassName = 'space-y-2',
  itemClassName = 'text-xl',
  inactiveClassName = 'text-ink-muted hover:text-ink',
}: NavigationLinksProps) {
  const tagItems: { label: string; tag: string | null }[] = [
    { label: 'All',   tag: null   },
    { label: 'Work',  tag: 'work' },
    { label: 'Art',   tag: 'art'  },
    { label: 'Vibes', tag: 'vibes' },
  ];

  // Only show Editor in development mode
  const isDevMode = process.env.NODE_ENV === 'development';

  return (
    <nav>
      <div>
        <p className="text-[10px] text-ink-faint mb-3 font-[family-name:var(--font-mori)]">Tools</p>
        <ul className={listClassName}>
          <li>
            <Link
              href="/canvas"
              className={`${itemClassName} transition-colors focus:outline-none block ${inactiveClassName}`}
            >
              <ScrambleText text="Canvas" />
            </Link>
          </li>
          <li>
            <Link
              href="/instrument"
              className={`${itemClassName} transition-colors focus:outline-none block ${inactiveClassName}`}
            >
              <ScrambleText text="Instrument" />
            </Link>
          </li>
          <li>
            <a
              href="/audiovisualizer.html"
              className={`${itemClassName} transition-colors focus:outline-none block ${inactiveClassName}`}
            >
              <ScrambleText text="Audiovisualizer" />
            </a>
          </li>
        </ul>
      </div>

      <div className="mt-12">
        <p className="text-[10px] text-ink-faint mb-3 font-[family-name:var(--font-mori)]">Filter by</p>
        <ul className={listClassName}>
          {tagItems.map(({ label, tag }) => {
            const href = blogTagHref(tag);
            const isActive = selectedTag === tag;
            const className = `${itemClassName} transition-colors focus:outline-none block ${
              isActive ? 'text-ink' : inactiveClassName
            }`;
            return (
              <li key={label}>
                {useLinks ? (
                  <Link href={href} className={className}>
                    <ScrambleText text={label} />
                  </Link>
                ) : (
                  <button
                    onClick={() => onTagSelect?.(tag)}
                    className={className}
                  >
                    <ScrambleText text={label} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ul className={`${listClassName} mt-12`}>
        <li>
          <Link
            href="/about"
            className={`${itemClassName} transition-colors focus:outline-none block ${inactiveClassName}`}
          >
            <ScrambleText text="About" />
          </Link>
        </li>
        <li>
          <ThemeToggle inline />
        </li>
        {isDevMode && (
          <li>
            <a
              href="/editor"
              className={`${itemClassName} text-ink-muted hover:text-ink transition-colors focus:outline-none`}
            >
              <ScrambleText text="Editor" />
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
