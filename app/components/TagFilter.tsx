'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PostMetadata } from '@/lib/posts';
import { PostCard } from './PostCard';

interface TagFilterProps {
  posts: PostMetadata[];
}

export function TagFilter({ posts }: TagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTag = searchParams.get('tag');

  const filteredPosts = useMemo(() => {
    if (!selectedTag) return posts;
    return posts.filter((post) =>
      post.tags.map((t) => t.toLowerCase()).includes(selectedTag.toLowerCase())
    );
  }, [posts, selectedTag]);

  return (
    <div className="space-y-10 md:space-y-12">
      {filteredPosts.length === 0 ? (
        <p className="text-ink-muted">
          {selectedTag
            ? `No posts found with tag "${selectedTag}". Try selecting a different tag.`
            : 'No posts yet. Add markdown files to the content/posts directory to get started.'}
        </p>
      ) : (
        filteredPosts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))
      )}
    </div>
  );
}
