'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Reports a page view on every navigation.
 *
 * The query string is part of the identity here, not decoration: `/?piece=veha`
 * and `/?work=photography` are different pages to a visitor, and reporting both
 * as `/` collapsed the whole gallery into a single number.
 */
export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    track('page_view', { page_path: query ? `${pathname}?${query}` : pathname });
  }, [pathname, query]);

  return null;
}
