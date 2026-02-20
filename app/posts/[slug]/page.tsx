import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPostSlugs, getPopularTags } from '@/lib/posts';
import PostPageClient from '@/app/components/PostPage';

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: post.title,
    description: post.description,
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const popularTags = getPopularTags(4);

  return <PostPageClient post={post} popularTags={popularTags} />;
}
