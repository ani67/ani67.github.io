import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { slug, content } = await request.json();

    if (!slug || !content) {
      return NextResponse.json(
        { error: 'Slug and content are required' },
        { status: 400 }
      );
    }

    const postsDirectory = path.join(process.cwd(), 'content/posts');

    // Create directory if it doesn't exist
    if (!fs.existsSync(postsDirectory)) {
      fs.mkdirSync(postsDirectory, { recursive: true });
    }

    const filePath = path.join(postsDirectory, `${slug}.md`);

    // Write the file
    fs.writeFileSync(filePath, content, 'utf8');

    // Revalidate all pages that show posts
    revalidatePath('/', 'layout');
    revalidatePath('/editor');
    revalidatePath(`/posts/${slug}`);

    return NextResponse.json({
      success: true,
      message: `Post saved to ${slug}.md`,
      path: filePath
    });
  } catch (error) {
    console.error('Failed to save post:', error);
    return NextResponse.json(
      { error: 'Failed to save post' },
      { status: 500 }
    );
  }
}
