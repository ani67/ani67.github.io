import { Suspense } from 'react';
import { getAllPosts, getPopularTags } from '@/lib/posts';
import { BlogLayout } from './components/layout/BlogLayout';
import { PostCard } from './components/PostCard';
import { TagFilter } from './components/TagFilter';
import { ActiveTagLinks } from './components/ActiveTagLinks';
import { NavigationLinks } from './components/layout/NavigationLinks';

export default function Page() {
  const posts = getAllPosts();
  const popularTags = getPopularTags(4);

  return (
    <BlogLayout
      popularTags={popularTags}
      navContent={
        <Suspense fallback={<NavigationLinks selectedTag={null} useLinks />}>
          <ActiveTagLinks />
        </Suspense>
      }
    >
      <main className="flex-1 px-6 pt-24 pb-24 md:px-0 md:pt-0 md:pb-32">
        <section>
          <h3 className="text-3xl md:text-[40px] font-light mb-12 md:mb-16 font-[family-name:var(--font-mondwest)] leading-snug text-white">
            Product designer and artist with 8+ years of experience, currently building AI native tools for the future
          </h3>

          <Suspense fallback={
            <div className="space-y-10 md:space-y-12">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          }>
            <TagFilter posts={posts} />
          </Suspense>
        </section>
      </main>
    </BlogLayout>
  );
}
