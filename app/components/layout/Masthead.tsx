import { ReactNode } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { ThemeToggle } from './ThemeToggle';
import { SocialLinks } from './SocialLinks';
import { Flame } from './Flame';
import { MastheadNav } from './MastheadNav';
import { SHELL_CONTAINER, SHELL_GRID, SHELL_CONTENT, SHELL_SPACER, SHELL_ASIDE } from './shell';

interface MastheadProps {
  /** The large headline. Omitted on pages that carry their own title. */
  headline?: ReactNode;
  /** Optional row under the headline — the tag filter, or the edit toggle. */
  below?: ReactNode;
}

/**
 * The top of every page: the mark and the theme control in the two corners, a
 * row of tabs, and the headline beneath them.
 *
 * Shared by the gallery homepage, /blog, /about and the post pages, so the
 * masthead is identical wherever you land. It replaced a left rail that had
 * drifted out of step between them; the nav now sits directly above the
 * headline, in the same column, rather than beside it.
 */
export function Masthead({ headline, below }: MastheadProps) {
  return (
    <header className="relative">
      {/* The mark and the theme control take the two top corners, so the nav
          line stays purely navigational. Both sit in the same 36px box for a
          matched optical weight across the top of the page. */}
      <Link
        href={ROUTES.home}
        aria-label="Ani Dalal — home"
        className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink md:left-6 md:top-6"
      >
        <Flame className="h-5 w-auto" />
      </Link>

      <div className="absolute right-4 top-4 z-20 flex items-center md:right-6 md:top-6">
        <SocialLinks />
        <ThemeToggle iconOnly />
      </div>

      <div className={SHELL_CONTAINER}>
        <div className={SHELL_GRID}>
          {/* Columns 1-2: left margin. Content starts at column 3. */}
          <div className={SHELL_SPACER}></div>
          <div className={SHELL_SPACER}></div>

          <div className={`${SHELL_CONTENT} px-6 pt-16 md:px-0 md:pt-0`}>
            <MastheadNav />

            {headline && (
              <p className="mt-10 text-3xl font-light leading-snug text-ink font-[family-name:var(--font-mondwest)] md:mt-12 md:text-[40px]">
                {headline}
              </p>
            )}

            {/* The same step the headline takes from the nav above it. Both
                neighbours are the same size and line-height, so matching the
                margins matches what the eye actually measures. */}
            {below && <div className="mt-10 md:mt-12">{below}</div>}
          </div>

          <div className={SHELL_ASIDE}></div>
        </div>
      </div>
    </header>
  );
}
