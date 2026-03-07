import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAllPostSlugs } from '@/lib/posts';

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const postsDirectory = path.join(process.cwd(), 'content/posts');
    const filePath = path.join(postsDirectory, `${slug}.md`);

    const content = fs.readFileSync(filePath, 'utf8');

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
}
