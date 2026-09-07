import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { parseISO, isValid } from 'date-fns';
import { PostFrontmatterSchema } from '@/lib/post-frontmatter';
import { PostFileError, savePostFile } from '@/lib/post-files.mjs';

const SaveRequest = z.object({
  slug: z.string(),
  previousSlug: z.string().nullable().default(null),
  content: z.string().min(1),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  try {
    const parsed = SaveRequest.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid save request' }, { status: 400 });
    const { slug, previousSlug, content } = parsed.data;
    let frontmatter;
    try {
      frontmatter = PostFrontmatterSchema.parse(matter(content).data);
    } catch {
      return NextResponse.json({ error: 'Invalid post frontmatter' }, { status: 400 });
    }
    if (!isValid(parseISO(frontmatter.date))) {
      return NextResponse.json({ error: 'Invalid post date' }, { status: 400 });
    }
    savePostFile(path.join(process.cwd(), 'content/posts'), slug, content, previousSlug);
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof PostFileError ? error.status : error instanceof SyntaxError ? 400 : 500;
    console.error('Failed to save post:', error);
    return NextResponse.json({ error: error instanceof PostFileError ? error.message : 'Failed to save post' }, { status });
  }
}
