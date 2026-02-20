import { Suspense } from 'react';
import { getAllPosts, getPopularTags } from '@/lib/posts';
import HomePage from './components/HomePage';

export default function Page() {
  const posts = getAllPosts();
  const popularTags = getPopularTags(4);

  return (
    <Suspense>
      <HomePage posts={posts} popularTags={popularTags} />
    </Suspense>
  );
}
