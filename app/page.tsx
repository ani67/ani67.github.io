import { getAllPosts, getPopularTags } from '@/lib/posts';
import HomePage from './components/HomePage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const params = await searchParams;
  const posts = getAllPosts();
  const popularTags = getPopularTags(4);
  const initialTag = params.tag || null;

  return <HomePage posts={posts} popularTags={popularTags} initialTag={initialTag} />;
}
