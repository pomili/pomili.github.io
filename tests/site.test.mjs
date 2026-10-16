import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const dist = resolve('dist');
const base = `/${(process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
const origin = process.env.SITE_URL || 'https://pomili.github.io';
const href = (path = '') => `${base}/${path}`;
const absolute = (path = '') => new URL(href(path), origin).href;
const navigation = [
  ['', '首页'], ['posts/', '文章'], ['tags/', '标签'], ['archives/', '归档'],
  ['aboutme/', '关于'], ['friends/', '友链'], ['promotion/', '推广'], ['search/', '搜索'],
];

async function filesIn(directory) {
  const entries = (await readdir(directory, { withFileTypes: true })).filter((entry) => !entry.name.startsWith('._'));
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const files = await filesIn(dist);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const readPage = (route = '') => readFile(join(dist, route, 'index.html'), 'utf8');

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  });
}

const textContent = (html) => decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0]);

// Parse attributes independently of their order, CSS classes, and boolean serialization.
function attributes(tag) {
  const result = {};
  const source = tag.replace(/^<[^\s>]+/, '').replace(/\/?\s*>$/, '');
  for (const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function postLinks(html) {
  return tags(html, 'a').map(attributes)
    .filter((attrs) => Object.hasOwn(attrs, 'data-post-link'))
    .map((attrs) => {
      assert.ok(attrs.href, 'A data-post-link anchor must have an href');
      return attrs.href;
    });
}

function canonical(html) {
  const links = tags(html, 'link').map(attributes).filter((attrs) => attrs.rel === 'canonical');
  assert.equal(links.length, 1, 'Expected one canonical link');
  return links[0].href;
}

function localFile(url) {
  const pathname = decodeURIComponent(new URL(url, origin).pathname);
  assert.ok(!base || pathname.startsWith(`${base}/`), `Missing base prefix: ${pathname}`);
  const path = resolve(dist, pathname.slice(base.length).replace(/^\//, ''));
  assert.ok(path.startsWith(`${dist}/`) || path === dist, `Path escapes dist: ${pathname}`);
  return pathname.endsWith('/') ? join(path, 'index.html') : path;
}

async function assertLocalAsset(value, documentUrl, source) {
  if (!value || value.startsWith('#')) return;
  const url = new URL(value, documentUrl);
  if (url.origin !== new URL(origin).origin) return;
  const path = localFile(url);
  try { assert.ok((await stat(path)).isFile()); }
  catch { assert.fail(`Unresolved link or asset in ${source}: ${value}`); }
}

const publishedLinks = postLinks(await readPage('posts/'));

test('eight navigation routes, compatibility pages, and metadata exist', async () => {
  const routes = [...navigation.map(([route]) => route), 'blog/', 'about/'];
  for (const route of routes) {
    const html = await readPage(route);
    assert.match(html, /<html[^>]*lang="zh-CN"/);
    assert.match(html, /<title>[^<]*pomili[^<]*<\/title>/);
    assert.match(html, /name="description"/);
    assert.match(html, /href="#main"/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route} should have one h1`);
    const primary = route === 'blog/' ? 'posts/' : route === 'about/' ? 'aboutme/' : route;
    assert.equal(canonical(html), absolute(primary), `Unexpected canonical for ${route}`);
  }
  const notFound = await readFile(join(dist, '404.html'), 'utf8');
  assert.match(notFound, /<html[^>]*lang="zh-CN"/);
  assert.match(notFound, /<title>[^<]*pomili[^<]*<\/title>/);
  assert.match(notFound, /name="robots" content="noindex"/);
  assert.equal((notFound.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.deepEqual(postLinks(await readPage('blog/')), publishedLinks, 'The legacy blog index must list the same published posts');
  assert.equal(new Set(publishedLinks).size, publishedLinks.length, 'Published article links must be unique');
});

test('every page has matching desktop/mobile navigation and the persistent shell', async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const className of ['sidebar-items', 'mobile-menu']) {
      const nav = [...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)]
        .find((match) => (attributes(`<nav${match[1]}>`).class || '').split(/\s+/).includes(className));
      assert.ok(nav, `Missing ${className} in ${file}`);
      const links = tags(nav[2], 'a').map(attributes).filter((attrs) => Object.hasOwn(attrs, 'data-nav'));
      assert.deepEqual(links.map((attrs) => [attrs['data-nav'], attrs.href]), navigation.map(([route]) => [route, href(route)]), file);
      for (const [, label] of navigation) assert.ok(textContent(nav[2]).includes(label), `Missing ${label} in ${file}`);
      const active = links.filter((attrs) => attrs['aria-current'] === 'page');
      const pathname = new URL(href(relative(dist, file).replace(/index\.html$/, '')), origin).pathname;
      const route = pathname.slice(base.length + 1);
      const expected = /^(posts|blog)\//.test(route) ? 'posts/' : /^(aboutme|about)\//.test(route) ? 'aboutme/' : navigation.find(([path]) => path ? route.startsWith(path) : route === '')?.[0];
      assert.deepEqual(active.map((attrs) => attrs['data-nav']), expected === undefined ? [] : [expected], file);
    }
    assert.equal(tags(html, 'div').map(attributes).filter((attrs) => attrs.id === 'swup-main').length, 1, file);
    assert.match(html, /<main\b[^>]*id="main"/);
    assert.match(html, /class="[^"]*floating-controls/);
    assert.match(html, /class="[^"]*theme-toggle/);
    const loader = tags(html, 'div').map(attributes).find((attrs) => attrs.id === 'loading-cover');
    assert.ok(loader && Object.hasOwn(loader, 'hidden'), `Loader must not block pages without JavaScript: ${file}`);
  }
});

test('every local HTML link, srcset candidate, and CSS asset resolves under the deployment base', async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const documentUrl = absolute(relative(dist, file).replace(/index\.html$/, ''));
    for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
      const attrs = attributes(tag[0]);
      for (const name of ['href', 'src']) {
        // Canonicals are metadata, not fetched assets (Astro's 404 canonical may end in /404/).
        if (attrs[name] && !(name === 'href' && attrs.rel === 'canonical')) await assertLocalAsset(attrs[name], documentUrl, file);
      }
      if (attrs.srcset) {
        // Inline data images are self-contained; commas in their payload are not candidate separators.
        const candidates = attrs.srcset.match(/(?:data:[^\s]+|[^\s,]+)(?:\s+[\d.]+[wx])?(?:\s*,|$)/g) || [];
        assert.ok(candidates.length, `Invalid srcset in ${file}`);
        for (const candidate of candidates) {
          await assertLocalAsset(candidate.trim().split(/\s+/)[0].replace(/,$/, ''), documentUrl, file);
        }
      }
    }
  }
  for (const file of files.filter((file) => file.endsWith('.css'))) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
      await assertLocalAsset(match[1], absolute(relative(dist, file)), file);
    }
  }
});

test('RSS and sitemap contain published articles and only primary index routes', async () => {
  const feed = await readFile(join(dist, 'rss.xml'), 'utf8');
  assert.match(feed, /<language>zh-CN<\/language>/);
  const channelLink = feed.match(/<channel>.*?<link>([^<]+)<\/link>/s);
  assert.ok(channelLink);
  assert.equal(decodeEntities(channelLink[1]), absolute());
  const feedLinks = [...feed.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map((match) => {
    const link = match[1].match(/<link>([^<]+)<\/link>/);
    assert.ok(link, 'RSS items must link to an article');
    return decodeEntities(link[1]);
  });
  assert.deepEqual(feedLinks.sort(), publishedLinks.map((link) => new URL(link, origin).href).sort());
  const sitemapFiles = files.filter((file) => /sitemap.*\.xml$/.test(file));
  assert.ok(sitemapFiles.length >= 1);
  const sitemap = (await Promise.all(sitemapFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeEntities(match[1]));
  assert.ok(locations.includes(absolute('posts/')));
  assert.ok(locations.includes(absolute('aboutme/')));
  assert.ok(!locations.includes(absolute('blog/')), 'Legacy blog index must not duplicate /posts/ in the sitemap');
  assert.ok(!locations.includes(absolute('about/')), 'Legacy about page must not duplicate /aboutme/ in the sitemap');
  assert.ok(!locations.includes(absolute('404/')) && !locations.includes(absolute('404.html')));
  for (const link of publishedLinks) {
    assert.ok(locations.includes(new URL(link, origin).href), `Missing published article: ${link}`);
    assert.ok((await stat(localFile(link))).isFile());
  }
});

test('the search index contains the actual published entries and plain-text article content', async () => {
  const page = await readPage('search/');
  const search = tags(page, 'div').map(attributes).find((attrs) => Object.hasOwn(attrs, 'data-search'));
  assert.equal(search?.['data-index-url'], href('search-index.json'));
  assert.match(page, /data-search-input/);
  assert.match(page, /data-search-results/);
  const index = JSON.parse(await readFile(localFile(search['data-index-url']), 'utf8'));
  assert.ok(Array.isArray(index));
  assert.deepEqual(index.map((entry) => entry.url).sort(), [...publishedLinks].sort(), 'Search must index every published article exactly once, not starter fixtures');
  for (const entry of index) {
    const html = await readFile(localFile(entry.url), 'utf8');
    assert.equal(canonical(html), new URL(entry.url, origin).href);
    const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/);
    assert.ok(title);
    assert.equal(entry.title, textContent(title[1]));
    const description = tags(html, 'meta').map(attributes).find((attrs) => attrs.name === 'description');
    assert.equal(entry.description, description?.content);
    assert.ok(Array.isArray(entry.tags) && entry.tags.every((tag) => typeof tag === 'string'));
    const articleTags = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
      .filter((match) => (attributes(`<a${match[1]}>`).class || '').split(/\s+/).includes('post-tag'))
      .map((match) => textContent(match[2]).replace(/^#/, ''));
    assert.deepEqual(entry.tags, articleTags);
    assert.equal(typeof entry.body, 'string');
    assert.equal(entry.body, entry.body.trim());
    assert.doesNotMatch(entry.body, /<\/?(?:script|style|p|h[1-6]|div)\b[^>]*>/i);
    const prose = html.match(/<div\b[^>]*class="prose"[^>]*>([\s\S]*?)<footer\b[^>]*class="article-footer"/);
    assert.ok(prose, `Missing article body: ${entry.url}`);
    const firstParagraph = prose[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
    if (firstParagraph) {
      const expected = textContent(firstParagraph[1]).replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
      if (expected) assert.ok(entry.body.includes(expected), `Search body must contain article text: ${entry.url}`);
    }
  }
});

test('article TOC templates link to real, unique headings at the correct depth', async () => {
  for (const link of publishedLinks) {
    const html = await readFile(localFile(link), 'utf8');
    const templates = [...html.matchAll(/<template\b([^>]*)>([\s\S]*?)<\/template>/g)]
      .filter((match) => attributes(`<template${match[1]}>`).id === 'page-toc');
    assert.equal(templates.length, 1, `Expected one page-toc template: ${link}`);
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/);
    assert.ok(article, `Missing article: ${link}`);
    const headings = [...article[1].matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/g)]
      .map((match) => ({ id: attributes(`<h${match[1]}${match[2]}>`).id, depth: match[1], text: textContent(match[3]) }))
      .filter((heading) => heading.id);
    assert.equal(new Set(headings.map((heading) => heading.id)).size, headings.length, `Duplicate heading IDs: ${link}`);
    const toc = [...templates[0][2].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => {
      const attrs = attributes(`<a${match[1]}>`);
      assert.ok(attrs.href?.startsWith('#') && attrs.href.length > 1, `Invalid TOC target: ${link}`);
      const id = decodeURIComponent(attrs.href.slice(1));
      const ids = tags(article[1], '[a-z][a-z0-9-]*').map(attributes).filter((attrs) => attrs.id === id);
      assert.equal(ids.length, 1, `TOC target must be unique in article: ${link}#${id}`);
      return { id, depth: attrs['data-depth'], text: textContent(match[2]) };
    });
    assert.deepEqual(toc, headings, `TOC must match the rendered headings in order: ${link}`);
  }
});

test('no draft fixture leaks into pages, feed, sitemap, or search JSON', async () => {
  for (const file of files.filter((file) => /\.(html|xml|json)$/.test(file))) {
    const content = await readFile(file, 'utf8');
    assert.ok(!content.includes('private-draft-fixture'), `Draft leaked in ${file}`);
  }
});

test('fonts are self-hosted with their copyright and OFL notices', async () => {
  for (const [font, authors] of [['inter', 'Inter Project Authors'], ['jetbrains-mono', 'JetBrains Mono Project Authors']]) {
    const notice = await readFile(join(dist, 'licenses', `${font}.txt`), 'utf8');
    assert.ok(notice.includes(authors));
    assert.match(notice, /Copyright/);
    assert.match(notice, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(notice, /PERMISSION & CONDITIONS/);
    assert.match(notice, /DISCLAIMER/);
    assert.ok(files.some((file) => file.includes(`${font}-`) && file.endsWith('.woff2')), `Missing bundled ${font} font`);
  }
  for (const file of [...htmlFiles, ...files.filter((file) => file.endsWith('.css'))]) {
    const content = await readFile(file, 'utf8');
    assert.doesNotMatch(content, /<script[^>]+src=["'](?:https?:)?\/\//i);
    assert.doesNotMatch(content, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    if (file.endsWith('.css')) assert.doesNotMatch(content, /url\(\s*["']?(?:https?:)?\/\//i);
  }
});

test('the homepage uses the responsive reference shell, not the old plant hero or post preview', async () => {
  const html = await readPage();
  assert.match(html, /data-home="true"/);
  assert.match(html, /class="hero-background"/);
  assert.match(html, /<picture>/);
  assert.ok(tags(html, 'source').filter((tag) => attributes(tag).srcset).length >= 2);
  assert.match(html, /class="hero-content"/);
  assert.match(html, /<h1[^>]*>pomili 的空间<\/h1>/);
  assert.deepEqual(postLinks(html), []);
  assert.doesNotMatch(html, /\b(?:plant-art|hero-art|hero-copy|hero-actions|latest-section|home-note)\b/);
  assert.doesNotMatch(html, /A LITTLE SPACE ON THE INTERNET|让想法，自然生长。|写一点，/);
});
