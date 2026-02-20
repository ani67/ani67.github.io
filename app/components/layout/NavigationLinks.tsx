import Link from 'next/link';
import { ScrambleText } from '../ScrambleText';

interface NavigationLinksProps {
  selectedTag: string | null;
  onTagSelect?: (tag: string | null) => void;
  useLinks?: boolean;
}

/**
 * Main navigation links
 */
export function NavigationLinks({ selectedTag, onTagSelect, useLinks }: NavigationLinksProps) {
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
      <ul className="space-y-0">
        {navItems.map(({ label, tag }) => (
          <li key={tag}>
            {useLinks ? (
              <Link
                href={`/?tag=${tag}`}
                className={`text-xl transition-colors focus:outline-none block ${
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
                className={`text-xl transition-colors focus:outline-none block ${
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
              className="text-xl text-white/50 hover:text-white transition-colors focus:outline-none"
            >
              <ScrambleText text="Editor" />
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
