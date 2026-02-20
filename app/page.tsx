import { getAllPosts, getPopularTags } from '@/lib/posts';
import HomePage from './components/HomePage';

export default function Page() {
  const posts = getAllPosts();
  const popularTags = getPopularTags(4);

  return <HomePage posts={posts} popularTags={popularTags} />;
}
