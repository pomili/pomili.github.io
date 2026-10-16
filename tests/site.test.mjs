import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dist = resolve('dist');
const base = `/${(process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
const origin = process.env.SITE_URL || 'https://pomili.github.io';
const href = (path = '') => `${base}/${path}`;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const files = await filesIn(dist);
const htmlFiles = files.filter((file) => file.endsWith('.html'));

function localFile(url) {
  const pathname = decodeURIComponent(new URL(url, origin).pathname);
  assert.ok(!base || pathname.startsWith(`${base}/`), `Missing base prefix: ${pathname}`);
  const relative = pathname.slice(base.length).replace(/^\//, '');
  const path = resolve(dist, relative);
  assert.ok(path.startsWith(`${dist}/`) || path === dist, `Path escapes dist: ${pathname}`);
  return pathname.endsWith('/') ? join(path, 'index.html') : path;
}

test('required routes and metadata exist', async () => {
  for (const route of ['index.html', 'blog/index.html', 'about/index.html', '404.html']) {
    const html = await readFile(join(dist, route), 'utf8');
    assert.match(html, /<html[^>]*lang="zh-CN"/);
    assert.match(html, /<title>[^<]*pomili[^<]*<\/title>/);
    assert.match(html, /name="description"/);
    assert.match(html, /href="#main"/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route} should have one h1`);
    if (route !== '404.html') {
      const canonical = html.match(/rel="canonical" href="([^"]+)"/);
      assert.ok(canonical);
      assert.equal(new URL(canonical[1]).origin, new URL(origin).origin);
      assert.ok(!base || new URL(canonical[1]).pathname.startsWith(`${base}/`));
    }
  }
});

test('every local HTML link and bundled asset resolves under the deployment base', async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1].replaceAll('&amp;', '&');
      if (!url.startsWith('/') || url.startsWith('//')) continue;
      const path = localFile(url);
      try { assert.ok((await stat(path)).isFile()); }
      catch { assert.fail(`Unresolved link in ${file}: ${url}`); }
    }
  }
});

test('RSS and sitemap contain published article URLs', async () => {
  const feed = await readFile(join(dist, 'rss.xml'), 'utf8');
  assert.match(feed, /<language>zh-CN<\/language>/);
  const channelLink = feed.match(/<channel>.*?<link>([^<]+)<\/link>/s);
  assert.ok(channelLink);
  assert.equal(channelLink[1], new URL(href(), origin).href);
  const archive = await readFile(join(dist, 'blog/index.html'), 'utf8');
  const articleLinks = [...archive.matchAll(/class="post-link" href="([^"]+)"/g)].map((match) => match[1]);
  for (const link of articleLinks) {
    assert.ok(feed.includes(new URL(link, origin).href));
    assert.ok((await stat(localFile(link))).isFile());
  }
  assert.equal((feed.match(/<item>/g) || []).length, articleLinks.length);
  const sitemapFiles = files.filter((file) => /sitemap.*\.xml$/.test(file));
  assert.ok(sitemapFiles.length >= 1);
  const sitemap = (await Promise.all(sitemapFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.ok(sitemap.includes(new URL(href('blog/'), origin).href));
  for (const link of articleLinks) assert.ok(sitemap.includes(new URL(link, origin).href));
  assert.ok(!sitemap.includes('/404/'));
});

test('no draft fixture leaks into pages, feed, or sitemap', async () => {
  for (const file of files.filter((f) => /\.(html|xml)$/.test(f))) {
    const content = await readFile(file, 'utf8');
    assert.ok(!content.includes('private-draft-fixture'), `Draft leaked in ${file}`);
  }
});

test('site does not depend on third-party scripts or fonts', async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  }
});
