import { NextResponse } from 'next/server';
import path from 'node:path';
import { getPostBySlug } from '@/lib/posts';
import { PostFileError, postPath } from '@/lib/post-files.mjs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  try {
    const { slug } = await params;
    postPath(path.join(process.cwd(), 'content/posts'), slug);
    const post = getPostBySlug(slug);
    return post ? NextResponse.json({ post }) : NextResponse.json({ error: 'Post not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid post' }, { status: error instanceof PostFileError ? error.status : 500 });
  }
}
