import { notFound } from 'next/navigation';
import { jsonLd, DEFAULT_IMAGE } from '@/lib/seo';
import { getPostBySlug, getAllPostSlugs, getRelatedPosts } from '@/lib/posts';
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
    alternates: {
      canonical: `/posts/${slug}/`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: `https://anidalal.com/posts/${slug}/`,
      publishedTime: post.date,
      tags: post.tags,
      images: [{ url: post.image || DEFAULT_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [post.image || DEFAULT_IMAGE],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const postJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: "Ani Dalal",
      url: "https://anidalal.com",
    },
    url: `https://anidalal.com/posts/${slug}/`,
    ...(post.image && { image: post.image }),
    ...(post.tags.length > 0 && { keywords: post.tags.join(", ") }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(postJsonLd) }}
      />
      <PostPageClient
        post={post}
        relatedPosts={getRelatedPosts(slug, post.tags)}
      />
    </>
  );
}
