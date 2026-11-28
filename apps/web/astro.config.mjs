import { defineConfig } from 'astro/config';

/**
 * SITE_URL is the public address the site is served from, with no trailing slash: the CloudFront
 * address (https://dXXXXXXXXXXXX.cloudfront.net) until there is a domain. It is used for canonical
 * links, the sitemap, Open Graph tags and the QR codes. CI passes it in; see docs/deploy-web.md.
 */
const site = (process.env.SITE_URL ?? 'http://localhost:4321').replace(/\/$/, '');

export default defineConfig({
  site,
  // Pages build to /features/index.html; a CloudFront Function maps /features to it.
  build: { format: 'directory', inlineStylesheets: 'auto' },
  trailingSlash: 'ignore',
  compressHTML: true,
  // The site talks to the API on the same origin (/v1/...). In dev, proxy it to a local API.
  vite: {
    // Emit every script as a file (never inline), so the CSP can be script-src 'self'.
    build: { assetsInlineLimit: 0 },
    server: { proxy: { '/v1': process.env.API_DEV_URL ?? 'http://localhost:4000' } },
  },
});
