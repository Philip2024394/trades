#!/usr/bin/env node
// One-shot HTML generator: reads nex-image-manifest.json, filters subject_domain === "staircase",
// emits a click-to-view gallery with sequential reference numbers.
// Usage: node scripts/build-nex-staircase-image-gallery.mjs
// Output: data/nex-reference-brains/staircase-preparation/nex-staircase-image-gallery-2026-07-31.html

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..');
const MANIFEST = path.join(ROOT, 'data', 'nex-image-manifest.json');
const OUT = path.join(ROOT, 'data', 'nex-reference-brains', 'staircase-preparation', 'nex-staircase-image-gallery-2026-07-31.html');

const raw = fs.readFileSync(MANIFEST, 'utf8');
const manifest = JSON.parse(raw);
const images = manifest.images ?? {};

const rows = Object.entries(images)
  .filter(([, meta]) => meta && meta.subject_domain === 'staircase')
  .map(([url, meta]) => ({
    url,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    a_plus: meta.a_plus === true,
    source: meta.source ?? '',
    description: (meta.description ?? '').split('\n')[0].slice(0, 140),
  }));

// Sort: a_plus first, then by URL alphabetically (stable, human-scannable)
rows.sort((a, b) => {
  if (a.a_plus !== b.a_plus) return a.a_plus ? -1 : 1;
  return a.url.localeCompare(b.url);
});

const total = rows.length;
const aPlusCount = rows.filter((r) => r.a_plus).length;

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const cards = rows
  .map((r, i) => {
    const ref = `STAIR-${String(i + 1).padStart(4, '0')}`;
    const aPlusBadge = r.a_plus ? '<span class="badge a-plus">A+</span>' : '';
    const tagLine = r.tags.slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    return `<a class="card" target="_blank" href="${esc(r.url)}"><img loading="lazy" src="${esc(r.url)}" alt="${ref}"><div class="label"><div class="ref">${ref} ${aPlusBadge}</div><div class="tags">${tagLine}</div><div class="desc">${esc(r.description)}</div></div></a>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NEX Staircase Image Gallery — ${total} images</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #222; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .card { background: #fff; border: 1px solid #e2e2e2; border-radius: 6px; overflow: hidden; display: block; text-decoration: none; color: inherit; transition: transform 0.1s, box-shadow 0.1s; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
  .card img { width: 100%; height: 180px; object-fit: contain; background: #fafafa; display: block; }
  .card .label { padding: 8px 10px; font-size: 12px; line-height: 1.35; }
  .card .ref { font-weight: 700; color: #111; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 10px; margin-left: 4px; }
  .badge.a-plus { background: #fbbf24; color: #78350f; font-weight: 700; }
  .card .tags { margin-top: 4px; }
  .tag { display: inline-block; background: #f0f0f0; color: #555; font-size: 10px; padding: 1px 5px; margin: 1px 3px 1px 0; border-radius: 3px; }
  .card .desc { color: #777; margin-top: 4px; font-size: 11px; }
  .filter-bar { margin-bottom: 16px; }
  .filter-bar input { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; width: 300px; }
  .filter-bar .count { margin-left: 12px; color: #666; font-size: 13px; }
</style>
</head>
<body>

<h1>NEX Staircase Image Gallery</h1>
<div class="meta">Regenerated ${new Date().toISOString().slice(0, 10)} · <strong>${total}</strong> images with <code>subject_domain === "staircase"</code> from <code>data/nex-image-manifest.json</code> · <strong>${aPlusCount}</strong> flagged A+ · sorted A+ first then URL alphabetical · click any tile to open full-size in new tab</div>

<div class="filter-bar">
  <input type="text" id="q" placeholder="Filter by reference, tag, or description..." oninput="applyFilter()">
  <span class="count" id="count"></span>
</div>

<div class="grid" id="grid">
${cards}
</div>

<script>
const grid = document.getElementById('grid');
const cards = Array.from(grid.querySelectorAll('.card'));
const countEl = document.getElementById('count');
function applyFilter() {
  const q = document.getElementById('q').value.toLowerCase();
  let shown = 0;
  cards.forEach((c) => {
    const t = c.innerText.toLowerCase();
    const visible = !q || t.includes(q);
    c.style.display = visible ? '' : 'none';
    if (visible) shown++;
  });
  countEl.textContent = q ? shown + ' / ' + cards.length + ' shown' : cards.length + ' images';
}
applyFilter();
</script>

</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT}`);
console.log(`Total staircase images: ${total}`);
console.log(`A+ flagged: ${aPlusCount}`);
