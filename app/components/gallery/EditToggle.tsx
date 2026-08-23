'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Enters and leaves gallery edit mode. Only rendered in development — see
 * `GalleryHome` — so it never ships to the deployed site.
 *
 * Styled as one more entry in the filter row rather than as a button: it sits
 * in that row, and a pill there read as a call to action when it is really
 * just another way to look at the same page.
 */
export function EditToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editing = searchParams.get('edit') === '1';

  return (
    <Link
      href={editing ? pathname : `${pathname}?edit=1`}
      scroll={false}
      className={`text-base font-semibold transition-colors focus:outline-none ${
        editing ? 'text-ink' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {editing ? 'Done' : 'Edit'}
    </Link>
  );
}
