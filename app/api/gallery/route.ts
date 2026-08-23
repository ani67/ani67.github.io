import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import { GalleryManifestSchema, manifestPath } from '@/lib/gallery';

/**
 * Writes the gallery manifest for the in-page editor.
 *
 * Development only, twice over: the deploy workflow deletes `app/api` before
 * building (static export can't emit dynamic routes), and the guard below
 * refuses to run in production regardless. The editor UI is likewise only
 * rendered in dev.
 *
 * Unlike the post routes this takes no path from the caller — it always writes
 * `content/gallery.json` — so there's no traversal surface. The body is
 * validated against the same schema the site reads with, which means a
 * malformed payload is rejected here instead of breaking the next build.
 */
export async function PUT(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = GalleryManifestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid manifest', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const ids = parsed.data.map((entry) => entry.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: `Duplicate id: ${[...new Set(duplicates)].join(', ')}` },
        { status: 400 }
      );
    }

    // Trailing newline so the file stays diff-friendly in git.
    fs.writeFileSync(manifestPath, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
    revalidatePath('/');

    return NextResponse.json({ success: true, count: parsed.data.length });
  } catch (error) {
    console.error('Failed to save gallery manifest:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
