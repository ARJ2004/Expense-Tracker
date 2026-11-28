/**
 * The web page a join link opens when the app isn't there to catch it (no app, or Android sends
 * the http link to the browser). Pure: it gets what to show and returns HTML. No scripts from
 * anywhere else, no members or amounts: only the group's name and icon and who invited.
 */
export interface JoinPageInput {
  code: string;
  displayCode: string;
  /** null when the link is unknown or turned off. */
  preview: { groupName: string; emoji: string | null; invitedBy: string } | null;
  packageName: string;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function renderJoinPage({ code, displayCode, preview, packageName }: JoinPageInput): string {
  const play = `https://play.google.com/store/apps/details?id=${packageName}&referrer=${encodeURIComponent(`join=${code}`)}`;
  const open = `intent://j/${code}#Intent;scheme=altus;package=${packageName};S.browser_fallback_url=${encodeURIComponent(play)};end`;
  const title = preview ? `Join ${preview.groupName} on Altus` : 'This link doesn’t work any more';
  const lead = preview
    ? `${escape(preview.invitedBy)} invited you to split expenses in <strong>${escape(preview.groupName)}</strong>.`
    : 'It was turned off or the group was deleted. Ask the person who sent it for a new one.';
  const body = preview
    ? `<a class="button primary" href="${escape(open)}">Open in Altus</a>
      <a class="button" href="${escape(play)}">Get Altus</a>
      <p class="muted">Already installed but nothing opened? In Altus go to Settings → Groups → Join with code and enter:</p>
      <button class="code" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}');this.dataset.copied='1'" aria-label="Copy the code ${displayCode}">${displayCode}</button>
      <p class="muted small">Everyone in the group sees its expenses and payments. Nothing else from your Altus account is shared.</p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(title)}</title>
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${preview ? escape(`${preview.invitedBy} invited you to split expenses on Altus.`) : 'Altus'}">
<style>
:root{--bg:#F8F9F9;--surface:#FFFFFF;--border:#DCE3E8;--text:#012A4A;--muted:#4A6378;--primary:#012A4A;--on-primary:#FFFFFF;--hero:#012A4A}
@media (prefers-color-scheme: dark){:root{--bg:#00111F;--surface:#071D30;--border:#14324B;--text:#EAF2F6;--muted:#9DB3C2;--primary:#2ECC71;--on-primary:#012A4A;--hero:#0A3354}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:420px;margin:0 auto;padding:32px 20px 48px;display:flex;flex-direction:column;gap:16px}
.hero{background:var(--hero);color:#fff;border-radius:28px;padding:24px;display:flex;flex-direction:column;gap:8px}
.emoji{font-size:40px;line-height:1}
.brand{font-weight:800;letter-spacing:.5px;color:#9FC3D8;font-size:13px;text-transform:uppercase}
h1{font-size:24px;line-height:1.25;margin:0}
p{margin:0}
.lead{color:#D6E6F0}
.button{display:flex;align-items:center;justify-content:center;height:56px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-weight:700;text-decoration:none}
.button.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.muted{color:var(--muted)}
.small{font-size:13px}
.code{font:600 26px/1 ui-monospace,"IBM Plex Mono",Menlo,monospace;letter-spacing:2px;padding:18px;border-radius:28px;border:1px dashed var(--border);background:var(--surface);color:var(--text);cursor:pointer}
.code[data-copied]::after{content:"  ✓ copied";font:600 13px system-ui;letter-spacing:0;color:var(--muted)}
</style>
</head>
<body>
<main>
  <section class="hero">
    <span class="brand">Altus</span>
    ${preview?.emoji ? `<span class="emoji" aria-hidden="true">${escape(preview.emoji)}</span>` : ''}
    <h1>${escape(title)}</h1>
    <p class="lead">${lead}</p>
  </section>
  ${body}
</main>
</body>
</html>`;
}
