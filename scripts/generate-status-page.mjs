#!/usr/bin/env node
// Generates a static, self-contained status.html — deployed alongside
// Storybook itself (written into storybook-static/ before the Pages
// upload step, since GitHub Pages replaces the ENTIRE site on every
// deploy; a status page generated in a separate workflow run would just
// wipe out the real Storybook content on its next deploy). Gives anyone a
// bookmarkable, no-login URL for "what's been happening" without opening
// Figma or the plugin.
//
// Honest about its own limits: this only runs when Storybook is rebuilt
// (the existing "Rebuild Storybook" button — deliberately manual, not
// automatic on every sync, per this project's own design). A "Storybook
// matches current tokens" boolean computed at build time would ALWAYS be
// true right after the build that computed it — trivially, not
// informative — so this page doesn't try to show one. What it shows
// instead is the last build timestamp plus the full recent-activity feed
// from the audit log, so a visitor can judge staleness themselves: if
// there are syncs listed after the "last built" time, Storybook is behind.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_ENTRIES = 20;

function readJson(relPath, fallback) {
  const full = path.join(root, relPath);
  if (!existsSync(full)) return fallback;
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    console.error(`[generate-status-page] Failed to parse ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
    return fallback;
  }
}

function readAuditLog() {
  const full = path.join(root, '.design-sync', 'audit-log.jsonl');
  if (!existsSync(full)) return [];
  return readFileSync(full, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function resolvedValueOf(token) {
  if (token === undefined) return '—';
  const v = token.$value;
  if (!v) return escapeHtml(JSON.stringify(token));
  if (v.kind === 'reference') return `→ ${escapeHtml(v.refKey)}`;
  return escapeHtml(typeof v.value === 'string' ? v.value : JSON.stringify(v.value));
}

function renderEntry(entry) {
  const when = new Date(entry.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const changeLines = (entry.changes ?? [])
    .slice(0, 8)
    .map((c) => `<li><code>${escapeHtml(c.category)}/${escapeHtml(c.key)}</code>: ${resolvedValueOf(c.previousValue)} → ${resolvedValueOf(c.newValue)}</li>`)
    .join('');
  const more = (entry.changes ?? []).length > 8 ? `<li class="muted">…and ${entry.changes.length - 8} more</li>` : '';
  return `
    <div class="entry">
      <div class="entry-head">
        <span class="actor">${escapeHtml(entry.actor)}</span>
        <span class="muted">${when}</span>
        <a href="${escapeHtml(entry.prUrl)}" target="_blank" rel="noopener">PR #${escapeHtml(String(entry.prNumber))}</a>
      </div>
      ${changeLines ? `<ul class="changes">${changeLines}${more}</ul>` : '<p class="muted">No token changes recorded for this sync.</p>'}
    </div>`;
}

function main() {
  const marker = readJson('.storybook-sync.json', null);
  const entries = readAuditLog().slice(0, MAX_ENTRIES);
  const builtAt = marker ? new Date(marker.builtAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Sync — Status</title>
<style>
  :root { color-scheme: light dark; --bg:#f5f6fa; --surface:#fff; --border:#ced0db; --text:#303240; --muted:#6c6f80; --accent:#009ecc; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1d1e26; --surface:#272833; --border:#585b69; --text:#fafafc; --muted:#acafbf; --accent:#48a4d0; } }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); }
  main { max-width: 640px; margin: 0 auto; padding: 32px 20px 60px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: var(--muted); font-size: 13px; margin: 0 0 28px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px 18px; margin-bottom: 16px; }
  .card h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 0 0 8px; }
  .muted { color: var(--muted); }
  a { color: var(--accent); }
  .entry { padding: 12px 0; border-bottom: 1px solid var(--border); }
  .entry:last-child { border-bottom: none; }
  .entry-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; font-size: 13px; margin-bottom: 6px; }
  .actor { font-weight: 700; }
  .changes { margin: 0; padding-left: 18px; font-size: 12.5px; }
  .changes li { margin-bottom: 3px; }
  .changes code { font-family: ui-monospace, monospace; font-size: 11.5px; }
  footer { text-align: center; color: var(--muted); font-size: 11px; margin-top: 24px; }
</style>
</head>
<body>
<main>
  <h1>Design Sync — Status</h1>
  <p class="subtitle">Figma ↔ GitHub ↔ Storybook token sync, generated at each Storybook rebuild.</p>

  <div class="card">
    <h2>Last Storybook build</h2>
    ${builtAt ? `<p>${builtAt}</p><p class="muted">Compare against the syncs below — anything listed after this time hasn't reached Storybook yet.</p>` : '<p class="muted">No build recorded yet.</p>'}
  </div>

  <div class="card">
    <h2>Recent syncs (${entries.length})</h2>
    ${entries.length > 0 ? entries.map(renderEntry).join('') : '<p class="muted">No sync history recorded yet.</p>'}
  </div>

  <footer>
    This page can't see Figma's live state — for that, use the Design Sync plugin's own Status tab.
  </footer>
</main>
</body>
</html>
`;

  const outDir = path.join(root, 'storybook-static');
  if (!existsSync(outDir)) {
    console.error('[generate-status-page] storybook-static/ not found — run "npm run build-storybook" first.');
    process.exitCode = 1;
    return;
  }
  writeFileSync(path.join(outDir, 'status.html'), html);
  console.log(`[generate-status-page] storybook-static/status.html written — ${entries.length} recent sync(s), last build ${builtAt ?? 'unknown'}.`);
}

main();
