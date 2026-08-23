import { Suspense } from 'react';
import { getAllPosts } from '@/lib/posts';
import { BlogLayout } from './layout/BlogLayout';
import { PostCard } from './PostCard';
import { TagFilter } from './TagFilter';
import { TagFilterBar } from './TagFilterBar';
import { Headline } from './layout/headline';
import { EditorLink } from './layout/EditorLink';

/**
 * The post index — headline, tag filter, and the list of posts.
 *
 * Lives at `/blog`.
 *
 * Both the filter row and the list read `?tag=` from the URL, which forces
 * them client-side, so each is wrapped in Suspense. The list's fallback
 * renders every post unfiltered, meaning the static HTML is complete and
 * useful before hydration.
 */
export function BlogIndex() {
  const posts = getAllPosts();

  return (
    <BlogLayout
      headline={<Headline />}
      belowHeadline={
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Suspense><TagFilterBar /></Suspense>
          <EditorLink />
        </div>
      }
    >
      <main className="flex-1 px-6 pt-16 pb-24 md:px-0 md:pt-10 md:pb-32">
        <Suspense fallback={
          <div className="space-y-10 md:space-y-12">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        }>
          <TagFilter posts={posts} />
        </Suspense>
      </main>
    </BlogLayout>
  );
}
