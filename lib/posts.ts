import fs from 'fs';
import path from 'path';
import { cache } from 'react';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import { z } from 'zod';
import { parseISO, compareDesc, isValid } from 'date-fns';

const postsDirectory = path.join(process.cwd(), 'content/posts');

/**
 * Schema for validating post frontmatter
 */
const PostFrontmatterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Date must be in YYYY-MM-DD or YYYY-MM-DDTHH:mm format'),
  description: z.string().min(1, 'Description is required'),
  image: z.string().nullish(),
  tags: z.array(z.string()).optional().default([]),
  published: z.boolean().optional().default(true),
});

export interface PostMetadata {
  title: string;
  date: string;
  description: string;
  slug: string;
  readingTime: string;
  image: string | null;
  tags: string[];
  published: boolean;
}

export interface Post extends PostMetadata {
  content: string;
}

/**
 * Reads and parses every post on disk, drafts included.
 *
 * Wrapped in React's `cache()` so the directory is read and validated once per
 * request/render pass instead of once per caller — `getPopularTags`,
 * `getPostsByTag` and friends all funnel through here, so an uncached version
 * meant a full re-read of `content/posts` for each of them.
 *
 * @returns Array of post metadata sorted by date (newest first)
 */
const readAllPosts = cache((): PostMetadata[] => {
  // Check if posts directory exists
  if (!fs.existsSync(postsDirectory)) {
    console.warn(`Posts directory does not exist: ${postsDirectory}`);
    return [];
  }

  try {
    const fileNames = fs.readdirSync(postsDirectory);
    const allPostsData = fileNames
      .filter((fileName) => fileName.endsWith('.md') && fileName !== 'README.md')
      .map((fileName) => {
        const slug = fileName.replace(/\.md$/, '');
        const fullPath = path.join(postsDirectory, fileName);

        try {
          const fileContents = fs.readFileSync(fullPath, 'utf8');
          const { data, content } = matter(fileContents);

          // Validate frontmatter with Zod
          const validatedData = PostFrontmatterSchema.parse(data);

          // Validate date format
          const parsedDate = parseISO(validatedData.date);
          if (!isValid(parsedDate)) {
            throw new Error(`Invalid date in ${fileName}: ${validatedData.date}`);
          }

          const { text } = readingTime(content);

          return {
            slug,
            title: validatedData.title,
            date: validatedData.date,
            description: validatedData.description,
            readingTime: text,
            image: validatedData.image || null,
            tags: validatedData.tags || [],
            published: validatedData.published,
          };
        } catch (error) {
          console.error(`Error processing post "${fileName}":`, error);
          return null;
        }
      })
      .filter((post): post is PostMetadata => post !== null);

    // Sort by date using proper date comparison
    return allPostsData.sort((a, b) =>
      compareDesc(parseISO(a.date), parseISO(b.date))
    );
  } catch (error) {
    console.error('Error reading posts directory:', error);
    return [];
  }
});

/**
 * Retrieves all blog posts from the content directory
 * @param options.includeDrafts - Include posts with `published: false`
 * @returns Array of post metadata sorted by date (newest first)
 */
export function getAllPosts(options?: { includeDrafts?: boolean }): PostMetadata[] {
  const all = readAllPosts();
  // Always hand back a copy — the underlying array is shared via `cache()`,
  // so an in-place `.sort()` by a caller would corrupt every later reader.
  return options?.includeDrafts
    ? all.slice()
    : all.filter((post) => post.published);
}

/**
 * Retrieves a single blog post by its slug
 * @param slug - The post slug (filename without .md extension)
 * @returns Post object with content, or null if not found/invalid
 */
export const getPostBySlug = cache((slug: string): Post | null => {
  try {
    // Validate slug to prevent path traversal
    if (!slug || slug.includes('..') || slug.includes('/')) {
      console.error(`Invalid slug: ${slug}`);
      return null;
    }

    const fullPath = path.join(postsDirectory, `${slug}.md`);

    if (!fs.existsSync(fullPath)) {
      console.warn(`Post not found: ${slug}`);
      return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    // Validate frontmatter with Zod
    const validatedData = PostFrontmatterSchema.parse(data);

    // Validate date format
    const parsedDate = parseISO(validatedData.date);
    if (!isValid(parsedDate)) {
      throw new Error(`Invalid date in ${slug}: ${validatedData.date}`);
    }

    // Block unpublished posts in production
    if (!validatedData.published && process.env.NODE_ENV === 'production') {
      return null;
    }

    const { text } = readingTime(content);

    return {
      slug,
      title: validatedData.title,
      date: validatedData.date,
      description: validatedData.description,
      content,
      readingTime: text,
      image: validatedData.image || null,
      tags: validatedData.tags || [],
      published: validatedData.published,
    };
  } catch (error) {
    console.error(`Error loading post "${slug}":`, error);
    return null;
  }
});

/**
 * Gets all post slugs for static generation (published only)
 * @returns Array of slugs (filenames without .md extension)
 */
export function getAllPostSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}

/**
 * Gets all unique tags from all posts
 * @returns Array of unique tag strings sorted alphabetically
 */
export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tagSet = new Set<string>();

  posts.forEach((post) => {
    post.tags.forEach((tag) => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

/**
 * Filters posts by a specific tag
 * @param tag - The tag to filter by
 * @returns Array of posts that include the specified tag
 */
export function getPostsByTag(tag: string): PostMetadata[] {
  const posts = getAllPosts();
  return posts.filter((post) =>
    post.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
  );
}

/**
 * Picks the posts most related to a given one, by shared-tag count.
 *
 * Deliberately deterministic: the site is a static export, so anything random
 * here is rolled once at build time and then frozen into the HTML — every
 * visitor sees the same "random" picks until the next deploy. Ranking by tag
 * overlap gives genuinely related posts instead, and ties fall back to the
 * newest-first order `getAllPosts` already guarantees (the sort is stable).
 *
 * @param slug - Slug of the post to find relatives for (excluded from results)
 * @param tags - Tags of that post
 * @param limit - Maximum number of posts to return (default: 3)
 */
export function getRelatedPosts(slug: string, tags: string[], limit = 3): PostMetadata[] {
  if (tags.length === 0) return [];

  const wanted = new Set(tags.map((t) => t.toLowerCase()));

  return getAllPosts()
    .filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      shared: post.tags.filter((t) => wanted.has(t.toLowerCase())).length,
    }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(({ post }) => post);
}

/**
 * Gets the most popular tags by post count
 * @param limit - Maximum number of tags to return (default: 4)
 * @returns Array of objects with tag name and count, sorted by count (descending)
 */
export function getPopularTags(limit = 4): { tag: string; count: number }[] {
  const posts = getAllPosts();
  const tagCounts: Record<string, number> = {};

  // Count occurrences of each tag
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // Convert to array and sort by count
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
