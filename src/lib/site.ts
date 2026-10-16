import { getCollection, type CollectionEntry } from 'astro:content';

export const site = {
  name: 'pomili',
  title: 'pomili 的空间',
  subtitle: 'A LITTLE SPACE FOR THOUGHTS AND DISCOVERIES',
  avatar: 'images/avatar.svg',
  banners: { desktop: 'images/banner.svg', tablet: 'images/banner-tablet.svg', mobile: 'images/banner-mobile.svg' },
  description: 'pomili 的个人空间。记录想法，分享笔记，让细小的思考有处安放。',
  language: 'zh-CN',
};

export function pathTo(path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function postPath(post: CollectionEntry<'blog'>) {
  return pathTo(`blog/${post.id.split('/').map(encodeURIComponent).join('/')}/`);
}

export async function getPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.id.localeCompare(b.id));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
  }).format(date).replaceAll('/', '.');
}

export function readingTime(body = '') {
  const chinese = (body.match(/[㐀-鿿]/g) || []).length;
  const words = (body.replace(/[㐀-鿿]/g, '').match(/[\p{L}\p{N}]+/gu) || []).length;
  return Math.max(1, Math.ceil(chinese / 400 + words / 220));
}
