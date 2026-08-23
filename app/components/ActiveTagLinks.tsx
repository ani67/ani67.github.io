'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { NavigationLinks } from './layout/NavigationLinks';
import { blogTagHref } from '@/lib/routes';

export function ActiveTagLinks() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedTag = searchParams.get('tag');

  const handleTagSelect = (tag: string | null) => {
    router.push(blogTagHref(tag));
  };

  return (
    <NavigationLinks
      selectedTag={selectedTag}
      onTagSelect={handleTagSelect}
    />
  );
}
