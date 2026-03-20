import Link from 'next/link';
import { ScrambleText } from '../ScrambleText';
import { ThemeToggle } from './ThemeToggle';

interface NavigationLinksProps {
  selectedTag: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
  listClassName?: string;
  itemClassName?: string;
  inactiveClassName?: string;
}

/**
 * Main navigation links
 */
export function NavigationLinks({ selectedTag, onTagSelect, useLinks, listClassName = 'space-y-2', itemClassName = 'text-xl', inactiveClassName = 'text-white/50 hover:text-white' }: NavigationLinksProps) {
  const tagItems = [
    { label: 'Work', tag: 'work' },
    { label: 'Art', tag: 'art' },
    { label: 'Vibes', tag: 'vibes' },
  ];

  // Only show Editor in development mode
  const isDevMode = process.env.NODE_ENV === 'development';

  return (
    <nav>
      <p className="text-[10px] text-white/30 mb-3 font-[family-name:var(--font-mori)]">Filter by</p>
      <ul className={listClassName}>
        {tagItems.map(({ label, tag }) => (
          <li key={tag}>
            {useLinks ? (
              <Link
                href={`/?tag=${tag}`}
                className={`${itemClassName} transition-colors focus:outline-none block ${
                  selectedTag === tag ? 'text-white' : inactiveClassName
                }`}
              >
                <ScrambleText text={label} />
              </Link>
            ) : (
              <button
                onClick={() => onTagSelect?.(tag)}
                className={`${itemClassName} transition-colors focus:outline-none block ${
                  selectedTag === tag ? 'text-white' : inactiveClassName
                }`}
              >
                <ScrambleText text={label} />
              </button>
            )}
          </li>
        ))}
      </ul>
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
              className={`${itemClassName} text-white/50 hover:text-white transition-colors focus:outline-none`}
            >
              <ScrambleText text="Editor" />
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
