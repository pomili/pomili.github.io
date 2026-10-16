import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, pathTo, postPath, site } from '../lib/site';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: new URL(pathTo(), context.site!),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postPath(post),
    })),
    customData: '<language>zh-CN</language>',
  });
}
