import Link from 'next/link';
import { ScrambleText } from '../ScrambleText';

interface NavigationLinksProps {
  selectedTag: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
  listClassName?: string;
  itemClassName?: string;
}

/**
 * Main navigation links
 */
export function NavigationLinks({ selectedTag, onTagSelect, useLinks, listClassName = 'space-y-2', itemClassName = 'text-xl' }: NavigationLinksProps) {
  const navItems = [
    { label: 'Work', tag: 'work' },
    { label: 'Art', tag: 'art' },
    { label: 'Vibes', tag: 'vibes' },
    { label: 'About', tag: 'about' },
  ];

  // Only show Editor in development mode
  const isDevMode = process.env.NODE_ENV === 'development';

  return (
    <nav>
      <ul className={listClassName}>
        {navItems.map(({ label, tag }) => (
          <li key={tag}>
            {useLinks ? (
              <Link
                href={`/?tag=${tag}`}
                className={`${itemClassName} transition-colors focus:outline-none block ${
                  selectedTag === tag
                    ? 'text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <ScrambleText text={label} />
              </Link>
            ) : (
              <button
                onClick={() => onTagSelect?.(tag)}
                className={`${itemClassName} transition-colors focus:outline-none block ${
                  selectedTag === tag
                    ? 'text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <ScrambleText text={label} />
              </button>
            )}
          </li>
        ))}
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
