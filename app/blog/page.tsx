import { BlogIndex } from '@/app/components/BlogIndex';

export const metadata = {
  title: 'Blog',
  description: 'Writing on design, AI, tools and generative art by Ani Dalal.',
  alternates: {
    canonical: '/blog/',
  },
};

export default function BlogPage() {
  return <BlogIndex />;
}
