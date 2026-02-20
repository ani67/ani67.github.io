import { notFound } from 'next/navigation';
import MarkdownEditor from '../components/MarkdownEditor';
import { getAllPosts } from '@/lib/posts';

export const metadata = {
  title: 'Markdown Editor',
  description: 'Live markdown editor and preview',
};

export default function EditorPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const posts = getAllPosts();

  return <MarkdownEditor posts={posts} />;
}
