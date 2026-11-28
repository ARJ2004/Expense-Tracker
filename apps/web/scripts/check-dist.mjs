// Checks the built site in dist/ (or, with --source, the page sources) before it can ship:
//  1. No third-party origins: fonts, scripts and images are all self-hosted.
//  2. Every JSON-LD block parses.
//  3. Every internal link and #anchor points at something that exists.
//  4. Placeholders such as [PRICING] or [VERIFY]: a warning before launch, an error for a launch
//     build (PUBLIC_PRELAUNCH unset or 0) so nothing unfinished goes live.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceMode = process.argv.includes('--source');
const dir = join(root, sourceMode ? 'src' : 'dist');
const launch = process.env.PUBLIC_PRELAUNCH !== '1';
const errors = [];
const warnings = [];

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dir).filter((f) => /\.(html|astro|md|ts|css|json)$/.test(f));

const THIRD_PARTY = /(fonts\.googleapis\.com|fonts\.gstatic\.com|googletagmanager|google-analytics|cdn\.jsdelivr|unpkg\.com|cdnjs)/;
const PLACEHOLDER = /\[(?:[A-Z][A-Z0-9 /'&.-]{1,40})(?::[^\]]{0,80})?\]/g;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  if (THIRD_PARTY.test(text)) errors.push(`${rel}: loads from a third-party origin`);
  if (!sourceMode && file.endsWith('.html')) {
    for (const m of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { errors.push(`${rel}: JSON-LD does not parse`); }
    }
    const found = new Set((text.replace(/<[^>]+>/g, ' ').match(PLACEHOLDER) ?? []).filter((p) => !/^\[(ALL|ON|NO)\]$/.test(p)));
    if (found.size) (launch ? errors : warnings).push(`${rel}: placeholders ${[...found].join(' ')}`);
  }
}

if (!sourceMode) {
  // Internal links and anchors.
  const pages = new Map();
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    let route = '/' + relative(dir, f).replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
    pages.set(route === '/' ? '/' : route, readFileSync(f, 'utf8'));
  }
  const ids = new Map([...pages].map(([r, html]) => [r, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
  const external = /^(https?:|mailto:|tel:|\/v1\/|\/get$|\/apk\/|\/j\/)/;
  for (const [route, html] of pages) {
    for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
      const href = m[1];
      if (external.test(href) || href.startsWith('/_astro/') || href.startsWith('/fonts/') || /\.(svg|png|ico|xml|txt|json)$/.test(href)) continue;
      const [path, hash] = href.split('#');
      const target = path === '' ? route : path.replace(/\/$/, '') || '/';
      if (!pages.has(target)) { errors.push(`${route}: link to missing page ${href}`); continue; }
      if (hash && !ids.get(target).has(hash)) errors.push(`${route}: link to missing anchor ${href}`);
    }
  }
  if (!existsSync(join(dir, '404.html'))) errors.push('dist/404.html is missing');
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`check-dist: ${files.length} files, ${errors.length} errors, ${warnings.length} warnings${launch ? '' : ' (pre-launch: placeholders are warnings)'}`);
process.exit(errors.length ? 1 : 0);
