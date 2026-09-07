import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('out');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
const titles = new Set();
for (const url of urls) {
  const route = new URL(url).pathname;
  const file = path.join(root, route, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const canonical = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonical.length, 1, `${route}: expected one canonical`);
  assert.equal(canonical[0][1], url, `${route}: wrong canonical`);
  const title = head.match(/<title>(.*?)<\/title>/s)?.[1];
  assert(title && !titles.has(title), `${route}: missing or duplicate title`);
  titles.add(title);
  assert.match(head, /<meta name="description" content="[^"]+"/, `${route}: missing description`);
  assert.match(head, /<meta property="og:url" content="[^"]+"/, `${route}: missing social URL`);
  assert.match(html, /<h1[\s>]/, `${route}: missing main heading`);
  assert(!head.includes('content="noindex"'), `${route}: indexable page marked noindex`);
}
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(home, /<noscript><style>.*#initial-cover/s, 'Missing no-JavaScript intro fallback');
assert.match(home, /href="\/work\/urban-trees-in-india\/"/, 'Missing crawlable project link');
assert.match(fs.readFileSync('app/components/PixelTransition.tsx', 'utf8'), /INITIAL_HOLD_MS = 1000/, 'Retain the requested intro delay');
assert(!fs.existsSync(path.join(root, 'api')), 'Development APIs must not ship');
console.log(`Verified ${urls.length} sitemap pages: unique titles, canonicals, descriptions, social URLs and H1s; intro fallback and game/project export intact.`);
