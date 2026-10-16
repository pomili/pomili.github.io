import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Override these for a different account, project repository, or custom domain.
const site = process.env.SITE_URL || 'https://pomili.github.io';
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
