import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

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
    const filePath = path.join(postsDirectory, `${slug}.md`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Delete the file
    fs.unlinkSync(filePath);

    // Revalidate all pages that show posts
    revalidatePath('/', 'layout');
    revalidatePath('/editor');

    return NextResponse.json({
      success: true,
      message: `Post ${slug}.md deleted`,
    });
  } catch (error) {
    console.error('Failed to delete post:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
