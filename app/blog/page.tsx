import { BlogIndex } from '@/app/components/BlogIndex';

import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Writing on Design, AI & Generative Art', 'Essays by Ani Dalal on product design, AI creation tools, generative art and building for the web.', '/blog/');

export default function BlogPage() {
  return <BlogIndex />;
}
