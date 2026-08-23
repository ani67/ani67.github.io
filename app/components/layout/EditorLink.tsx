import Link from 'next/link';
import { ScrambleText } from '../ScrambleText';

/**
 * Link into the markdown editor, for the row beneath the blog's headline.
 *
 * It used to live in the left rail; the rail is gone, and it went with it. The
 * filter row is where the gallery keeps its equivalent, so it belongs here too.
 *
 * Renders nothing outside development, which keeps it out of the static export
 * the same way the gallery's edit toggle is kept out.
 */
export function EditorLink() {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <Link
      href="/editor"
      className="text-base font-semibold text-ink-muted transition-colors hover:text-ink focus:outline-none"
    >
      <ScrambleText text="Editor" />
    </Link>
  );
}
