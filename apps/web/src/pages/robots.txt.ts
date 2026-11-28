import type { APIRoute } from 'astro';
import { prelaunch } from '../data/site';

/** Before launch (PUBLIC_PRELAUNCH=1) nothing is crawled. Invite pages and APK files never are. */
export const GET: APIRoute = ({ site }) => {
  const body = prelaunch
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /j/\nDisallow: /apk/\nDisallow: /v1/\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
