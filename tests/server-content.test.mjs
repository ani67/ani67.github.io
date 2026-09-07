import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as postFiles from '../lib/post-files.mjs';
import { serializePost } from '../lib/serialize-post.mjs';
import { loadTypeScript } from './load-typescript.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function fixture(t) {
  const original = process.cwd();
  const env = process.env.NODE_ENV;
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'portfolio-server-test-'));
  fs.mkdirSync(path.join(dir, 'content/posts'), { recursive: true });
  process.chdir(dir);
  process.env.NODE_ENV = 'development';
  t.after(() => {
    process.chdir(original);
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function routes() {
  const mocks = {
    'next/cache': { revalidatePath() {} },
    '@/lib/post-files.mjs': postFiles,
    '@/lib/post-frontmatter': loadTypeScript(path.join(root, 'lib/post-frontmatter.ts')),
    '@/lib/posts': loadTypeScript(path.join(root, 'lib/posts.ts')),
  };
  return {
    save: loadTypeScript(path.join(root, 'app/api/save-post/route.ts'), mocks).POST,
    remove: loadTypeScript(path.join(root, 'app/api/delete-post/route.ts'), mocks).POST,
    read: loadTypeScript(path.join(root, 'app/api/posts/[slug]/route.ts'), mocks).GET,
  };
}

const request = (body) => new Request('http://localhost/api/save-post', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('gallery rejects malformed JSON, invalid entries and duplicate ids instead of returning an empty gallery', (t) => {
  const dir = fixture(t);
  const { readManifest } = loadTypeScript(path.join(root, 'lib/gallery.ts'));
  const file = path.join(dir, 'content/gallery.json');
  for (const content of ['{', '[{"id":""}]', '[{"id":"duplicate"},{"id":"duplicate"}]']) {
    fs.writeFileSync(file, content);
    assert.throws(() => readManifest());
  }
  fs.writeFileSync(file, '[{"id":"valid","title":"Work"}]');
  assert.equal(readManifest()[0].title, 'Work');
});

test('save and read APIs round-trip quoted metadata and rename without deleting first', async (t) => {
  const dir = fixture(t);
  const { save, read } = routes();
  const metadata = { title: 'A "quoted" title', description: 'Two\nlines', date: '2026-09-07', tags: ['art', 'tools'], image: null, published: false };
  const content = serializePost(metadata, '# Text');
  assert.equal((await save(request({ slug: 'original', content }))).status, 200);
  assert.equal((await save(request({ slug: 'renamed', previousSlug: 'original', content }))).status, 200);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'content/posts')), ['renamed.md']);
  const response = await read(new Request('http://localhost/api/posts/renamed'), { params: Promise.resolve({ slug: 'renamed' }) });
  assert.equal(response.status, 200);
  const { post } = await response.json();
  for (const key of Object.keys(metadata)) assert.deepEqual(post[key], metadata[key]);
});

test('invalid frontmatter and dates leave the original untouched', async (t) => {
  const dir = fixture(t);
  const { save } = routes();
  fs.writeFileSync(path.join(dir, 'content/posts/original.md'), 'protected');
  for (const content of ['---\ntitle: "a "quote""\n---\nText', serializePost({ title: 'Title', description: 'Description', date: '2026-02-30', tags: [], image: null, published: true }, 'Text')]) {
    assert.equal((await save(request({ slug: 'renamed', previousSlug: 'original', content }))).status, 400);
  }
  assert.deepEqual(fs.readdirSync(path.join(dir, 'content/posts')), ['original.md']);
  assert.equal(fs.readFileSync(path.join(dir, 'content/posts/original.md'), 'utf8'), 'protected');
});

test('all post APIs refuse production access', async (t) => {
  fixture(t);
  const { save, remove, read } = routes();
  process.env.NODE_ENV = 'production';
  assert.equal((await save(request({}))).status, 404);
  assert.equal((await remove(request({ slug: 'anything' }))).status, 404);
  assert.equal((await read(new Request('http://localhost/api/posts/anything'), { params: Promise.resolve({ slug: 'anything' }) })).status, 404);
});
