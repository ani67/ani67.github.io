import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { postPath, savePostFile, deletePostFile } from '../lib/post-files.mjs';
import { serializePost } from '../lib/serialize-post.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'portfolio-post-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('rejects traversal, separators, empty and non-string slugs for every file operation', (t) => {
  const dir = fixture(t);
  for (const slug of ['../outside', 'a/b', 'a\\b', '', '.', '..', 'README', '%2e%2e', null, 12, {}]) {
    assert.throws(() => postPath(dir, slug));
    assert.throws(() => savePostFile(dir, slug, 'content'));
    assert.throws(() => deletePostFile(dir, slug));
  }
  assert.throws(() => savePostFile(dir, 'safe', 'content', '../outside'));
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('creates, updates, renames and deletes posts', (t) => {
  const dir = fixture(t);
  savePostFile(dir, 'original', 'v1');
  savePostFile(dir, 'original', 'v2', 'original');
  assert.equal(fs.readFileSync(path.join(dir, 'original.md'), 'utf8'), 'v2');
  savePostFile(dir, 'renamed', 'v3', 'original');
  assert.deepEqual(fs.readdirSync(dir), ['renamed.md']);
  assert.equal(fs.readFileSync(path.join(dir, 'renamed.md'), 'utf8'), 'v3');
  deletePostFile(dir, 'renamed');
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('rename collisions preserve both existing posts', (t) => {
  const dir = fixture(t);
  savePostFile(dir, 'original', 'original text');
  savePostFile(dir, 'occupied', 'other text');
  assert.throws(() => savePostFile(dir, 'occupied', 'replacement', 'original'), { status: 409 });
  assert.throws(() => savePostFile(dir, 'occupied', 'new post'), { status: 409 });
  assert.equal(fs.readFileSync(path.join(dir, 'original.md'), 'utf8'), 'original text');
  assert.equal(fs.readFileSync(path.join(dir, 'occupied.md'), 'utf8'), 'other text');
});

test('failed replacement writes keep the original and clean up temporary files', (t) => {
  const dir = fixture(t);
  savePostFile(dir, 'original', 'original text');
  assert.throws(() => savePostFile(dir, 'renamed', undefined, 'original'));
  assert.deepEqual(fs.readdirSync(dir), ['original.md']);
  assert.equal(fs.readFileSync(path.join(dir, 'original.md'), 'utf8'), 'original text');
  assert.throws(() => savePostFile(dir, 'new', 'text', 'missing'), { status: 404 });
});

test('refuses symlink posts without changing their target', (t) => {
  const dir = fixture(t);
  const outside = path.join(dir, 'outside.txt');
  fs.writeFileSync(outside, 'protected');
  fs.symlinkSync(outside, path.join(dir, 'linked.md'));
  assert.throws(() => savePostFile(dir, 'linked', 'overwritten', 'linked'));
  assert.throws(() => deletePostFile(dir, 'linked'));
  assert.equal(fs.readFileSync(outside, 'utf8'), 'protected');
});

test('frontmatter round-trips quotes, newlines, Unicode, backslashes and all tags', () => {
  const metadata = {
    title: 'A "quoted" title: café',
    date: '2026-09-07T12:30',
    description: 'A line\nAnother "line" with C:\\files',
    tags: ['art', 'design, tools'],
    image: null,
    published: false,
  };
  const parsed = matter(serializePost(metadata, '# Heading\n\nBody'));
  assert.deepEqual(parsed.data, metadata);
  assert.equal(parsed.content.trim(), '# Heading\n\nBody');
});
