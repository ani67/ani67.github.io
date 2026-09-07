import type { MetadataRoute } from 'next';
import { getWorkProjects } from '@/lib/work';
import { getAllPosts } from '@/lib/posts';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://anidalal.com/posts/${post.slug}/`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      url: 'https://anidalal.com/',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://anidalal.com/blog/',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://anidalal.com/about/',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://anidalal.com/interplanetary-racers/',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...['/instrument/', '/canvas/', '/work/'].map((route) => ({ url: `https://anidalal.com${route}` })),
    ...getWorkProjects().map((entry) => ({ url: `https://anidalal.com/work/${entry.id}/` })),
    ...postEntries,
  ];
}
