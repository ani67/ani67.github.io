'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PostMetadata } from '@/lib/posts';
import { BlogLayout } from './layout/BlogLayout';
import { PostCard } from './PostCard';

interface HomePageProps {
  posts: PostMetadata[];
  popularTags: { tag: string; count: number }[];
  initialTag: string | null;
}

export default function HomePage({ posts, popularTags, initialTag }: HomePageProps) {
  const router = useRouter();
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);

  // Update selected tag when initialTag changes (e.g., browser back/forward)
  useEffect(() => {
    setSelectedTag(initialTag);
  }, [initialTag]);

  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
    // Update URL with selected tag
    if (tag) {
      router.push(`/?tag=${encodeURIComponent(tag)}`);
    } else {
      router.push('/');
    }
  };

  // Filter posts based on selected tag
  const filteredPosts = useMemo(() => {
    if (!selectedTag) return posts;
    return posts.filter((post) =>
      post.tags.map((t) => t.toLowerCase()).includes(selectedTag.toLowerCase())
    );
  }, [posts, selectedTag]);

  return (
    <BlogLayout
      popularTags={popularTags}
      selectedTag={selectedTag}
      onTagSelect={handleTagSelect}
    >
      {/* Main Content */}
      <main className="flex-1 px-6 pt-24 pb-24 md:px-0 md:pt-0 md:pb-32">
        {/* Blog Posts Section */}
        <section>
            <h3 className="text-[40px] font-light mb-12 md:mb-16 font-[family-name:var(--font-mondwest)] leading-tight text-white">
              Product designer and artist with 8+ years of experience, currently building AI native tools for the future
            </h3>

            <div className="space-y-10 md:space-y-12">
              {filteredPosts.length === 0 ? (
                <p className="text-white/50">
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
        </section>
      </main>
    </BlogLayout>
  );
}
