import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      );
    }

    const postsDirectory = path.join(process.cwd(), 'content/posts');
    const originalFilePath = path.join(postsDirectory, `${slug}.md`);

    // Check if original file exists
    if (!fs.existsSync(originalFilePath)) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Read the original file
    const content = fs.readFileSync(originalFilePath, 'utf8');

    // Generate new slug with -copy suffix, increment if exists
    let newSlug = `${slug}-copy`;
    let counter = 1;
    while (fs.existsSync(path.join(postsDirectory, `${newSlug}.md`))) {
      counter++;
      newSlug = `${slug}-copy-${counter}`;
    }

    // Write the duplicate file
    const newFilePath = path.join(postsDirectory, `${newSlug}.md`);
    fs.writeFileSync(newFilePath, content, 'utf8');

    // Revalidate all pages that show posts
    revalidatePath('/', 'layout');
    revalidatePath('/editor');
    revalidatePath(`/posts/${newSlug}`);

    return NextResponse.json({
      success: true,
      message: `Post duplicated as ${newSlug}.md`,
      newSlug,
    });
  } catch (error) {
    console.error('Failed to duplicate post:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate post' },
      { status: 500 }
    );
  }
}
