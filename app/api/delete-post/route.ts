import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import path from 'node:path';
import { PostFileError, deletePostFile } from '@/lib/post-files.mjs';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  try {
    const { slug } = await request.json();
    deletePostFile(path.join(process.cwd(), 'content/posts'), slug);
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof PostFileError ? error.status : error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: error instanceof PostFileError ? error.message : 'Failed to delete post' }, { status });
  }
}
