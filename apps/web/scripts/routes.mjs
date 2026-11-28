// Prints the site's page routes as JSON (["/features", …]) for the CloudFront KeyValueStore key
// "routes". The viewer-request function maps those to /<route>/index.html and anything else to
// the 404 page. Usage: node scripts/routes.mjs [dist]
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? new URL('../dist', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const routes = walk(dist)
  .filter((f) => f.endsWith('/index.html') && !f.endsWith(`${dist}/index.html`))
  .map((f) => '/' + relative(dist, f).replace(/\/index\.html$/, ''))
  .filter((r) => r !== '/' && !r.startsWith('/_astro'))
  .sort();
process.stdout.write(JSON.stringify(routes));
