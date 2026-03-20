'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { NavigationLinks } from './layout/NavigationLinks';

export function ActiveTagLinks() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedTag = searchParams.get('tag');

  const handleTagSelect = (tag: string | null) => {
    if (tag) {
      router.push(`/?tag=${encodeURIComponent(tag)}`);
    } else {
      router.push('/');
    }
  };

  return (
    <NavigationLinks
      selectedTag={selectedTag}
      onTagSelect={handleTagSelect}
    />
  );
}

export function MobileActiveTagLinks({ onClose }: { onClose: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedTag = searchParams.get('tag');

  const handleTagSelect = (tag: string | null) => {
    if (tag) {
      router.push(`/?tag=${encodeURIComponent(tag)}`);
    } else {
      router.push('/');
    }
    onClose();
  };

  return (
    <NavigationLinks
      selectedTag={selectedTag}
      onTagSelect={handleTagSelect}
      listClassName="space-y-3"
      itemClassName="text-xl"
      inactiveClassName="text-white"
    />
  );
}
