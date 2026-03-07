import { getAllPosts } from '@/lib/posts';

export const dynamic = 'force-static';

export async function GET() {
  const posts = getAllPosts();

  const postsList = posts
    .map((post) => `- [${post.title}](https://anidalal.com/posts/${post.slug}/): ${post.description}`)
    .join('\n');

  const content = `# Ani Dalal

> Product designer and artist with 8+ years of experience, currently building AI native tools for the future.

Ani Dalal is a product designer and artist based in Bengaluru, India. He has worked at Dashverse.AI (Frameo, Dashtoon Studio), Univ.AI, and Samsung R&D (Bixby). He holds a Master of Design from IIT Guwahati and a Post Graduate Diploma from Strelka Institute. His art practice spans generative art, speculative cartography, and digital experiences, exhibited internationally.

## Blog Posts

${postsList}

## Pages

- [Home](https://anidalal.com/): Portfolio and blog homepage
- [About](https://anidalal.com/about/): Background, experience, education, exhibitions, and contact

## Contact

- Email: anidalal3@gmail.com
- Location: Bengaluru, India
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
