import Link from 'next/link';
import { ScrambleText } from '../ScrambleText';

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
  const navItems = [
    { label: 'Work', tag: 'work', href: null },
    { label: 'Art', tag: 'art', href: null },
    { label: 'Vibes', tag: 'vibes', href: null },
    { label: 'About', tag: 'about', href: '/about' },
  ];

  // Only show Editor in development mode
  const isDevMode = process.env.NODE_ENV === 'development';

  return (
    <nav>
      <ul className={listClassName}>
        {navItems.map(({ label, tag, href }) => (
          <li key={tag}>
            {href ? (
              <Link
                href={href}
                className={`${itemClassName} transition-colors focus:outline-none block ${inactiveClassName}`}
              >
                <ScrambleText text={label} />
              </Link>
            ) : useLinks ? (
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
