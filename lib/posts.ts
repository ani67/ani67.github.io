import fs from 'fs';
import path from 'path';
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  description: z.string().min(1, 'Description is required'),
  image: z.string().nullish(),
  tags: z.array(z.string()).optional().default([]),
});

export interface PostMetadata {
  title: string;
  date: string;
  description: string;
  slug: string;
  readingTime: string;
  image: string | null;
  tags: string[];
}

export interface Post extends PostMetadata {
  content: string;
}

/**
 * Retrieves all blog posts from the content directory
 * @returns Array of post metadata sorted by date (newest first)
 */
export function getAllPosts(): PostMetadata[] {
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
}

/**
 * Retrieves a single blog post by its slug
 * @param slug - The post slug (filename without .md extension)
 * @returns Post object with content, or null if not found/invalid
 */
export function getPostBySlug(slug: string): Post | null {
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
    };
  } catch (error) {
    console.error(`Error loading post "${slug}":`, error);
    return null;
  }
}

/**
 * Gets all post slugs for static generation
 * @returns Array of slugs (filenames without .md extension)
 */
export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) {
    console.warn(`Posts directory does not exist: ${postsDirectory}`);
    return [];
  }

  try {
    const fileNames = fs.readdirSync(postsDirectory);
    return fileNames
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => fileName.replace(/\.md$/, ''));
  } catch (error) {
    console.error('Error reading post slugs:', error);
    return [];
  }
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
