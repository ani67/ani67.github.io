import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class PostFileError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function postPath(directory, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new PostFileError('Use a nonempty lowercase slug with letters, numbers and hyphens');
  }
  const file = path.join(directory, `${slug}.md`);
  // Do not follow a hand-created symlink outside the content directory.
  try {
    if (!fs.lstatSync(file).isFile()) throw new PostFileError('Post must be a regular file');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return file;
}

/**
 * Publish the replacement before removing an old slug; never overwrite another post.
 * @param {string} directory
 * @param {string} slug
 * @param {string} content
 * @param {string | null} previousSlug
 */
export function savePostFile(directory, slug, content, previousSlug = null) {
  const destination = postPath(directory, slug);
  const previous = previousSlug === null ? null : postPath(directory, previousSlug);
  if (previous && !fs.existsSync(previous)) throw new PostFileError('Original post not found', 404);
  if (destination !== previous && fs.existsSync(destination)) {
    throw new PostFileError('A post with that slug already exists', 409);
  }
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    if (destination === previous) {
      fs.renameSync(temporary, destination);
    } else {
      // Linking is atomic and fails if another save has claimed the destination.
      fs.linkSync(temporary, destination);
    }
    if (previous && previous !== destination) fs.unlinkSync(previous);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function deletePostFile(directory, slug) {
  const file = postPath(directory, slug);
  if (!fs.existsSync(file)) throw new PostFileError('Post not found', 404);
  fs.unlinkSync(file);
}
