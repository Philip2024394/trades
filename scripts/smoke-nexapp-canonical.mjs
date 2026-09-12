#!/usr/bin/env node
// scripts/smoke-nexapp-canonical.mjs
//
// Founder Phase 30 · P30-4 · /nexapp is the canonical NEX chat home.
//
// Verifies:
//   A · /nexapp                  renders 200 (chat home · NexAppShell)
//   B · /nexapp/directory        renders 200
//   C · /nexapp/search           renders 200
//   D · /nexapp/voice            renders 200
//   E · /nexapp/tools            renders 200
//   F · /nexapp/settings         renders 200
//   G · /nexapp/accessibility    renders 200 + WCAG marker
//   H · /nexapp/vs-frontier      renders 200 + NEX vs Frontier marker
//   I · /nexapp/evidence         renders 200
//   J · /nexapp/directory bundle contains data-cards-grid + honesty + ask markers
//   K · /nexapp/* bundle contains data-nex-quick-search-trigger (magnifying-glass icon)
//   L · middleware declares redirect to /nexapp

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function j(pth) {
  const res = await fetch(`${HOST}${pth}`, { redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get("location") };
}

async function bundleContains(pagePath, patterns) {
  const html = (await j(pagePath)).text;
  const chunkMatch = html.match(/\/_next\/static\/[^"'\s]+\.(js|mjs)/g) ?? [];
  const uniq = [...new Set(chunkMatch)];
  const seen = new Map(patterns.map((p) => [p, false]));
  for (const url of uniq.slice(0, 40)) {
    try {
      const src = await (await fetch(`${HOST}${url}`)).text();
      for (const p of patterns) if (!seen.get(p) && src.includes(p)) seen.set(p, true);
      if ([...seen.values()].every(Boolean)) break;
    } catch { /* ignore */ }
  }
  return Object.fromEntries(seen);
}

const routes = [
  { case: "A", path: "/nexapp",               must: null },
  { case: "B", path: "/nexapp/directory",     must: null },
  { case: "C", path: "/nexapp/search",        must: null },
  { case: "D", path: "/nexapp/voice",         must: null },
  { case: "E", path: "/nexapp/tools",         must: null },
  { case: "F", path: "/nexapp/settings",      must: "NEX Settings" },
  { case: "G", path: "/nexapp/accessibility", must: "WCAG" },
  { case: "H", path: "/nexapp/vs-frontier",   must: "NEX vs Frontier" },
  { case: "I", path: "/nexapp/evidence",      must: null },
];
for (const r of routes) {
  console.log(`\n══ ${r.case} · ${r.path} renders`);
  const res = await j(r.path);
  console.log(`  status=${res.status}`);
  if (res.status !== 200) failures.push({ case: r.case, reason: `status_${res.status}` });
  if (r.must && !res.text.includes(r.must)) failures.push({ case: r.case, reason: `missing_marker_${r.must}` });
}

// ══ J · directory bundle has cards-grid + ask + honesty markers
console.log(`\n══ J · /nexapp/directory bundle has core interaction markers`);
{
  const found = await bundleContains("/nexapp/directory", [
    "data-cards-grid", "data-card-toggle", "data-ask-form", "data-honesty-chip",
  ]);
  console.log(`  ${JSON.stringify(found)}`);
  for (const [k, v] of Object.entries(found)) if (!v) failures.push({ case: "J", reason: `no_${k}` });
}

// ══ K · magnifying-glass icon present in /nexapp bundle
console.log(`\n══ K · magnifying-glass search icon in /nexapp bundle`);
{
  const found = await bundleContains("/nexapp/search", [
    "data-nex-quick-search-trigger", "data-nex-quick-search-input",
  ]);
  console.log(`  ${JSON.stringify(found)}`);
  if (!found["data-nex-quick-search-trigger"]) failures.push({ case: "K", reason: "no_search_trigger" });
  if (!found["data-nex-quick-search-input"]) failures.push({ case: "K", reason: "no_search_input" });
}

// ══ L · middleware declares the /nexapp redirect
console.log(`\n══ L · middleware.ts declares redirect to /nexapp`);
{
  const { readFile } = await import("node:fs/promises");
  const mw = await readFile("src/middleware.ts", "utf8");
  const hasBlock = /Phase 30[\s\S]*?nex\/chat[\s\S]*?"\/nexapp"/.test(mw);
  console.log(`  block_declared=${hasBlock}`);
  if (!hasBlock) failures.push({ case: "L", reason: "middleware_block_missing" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · /nexapp is canonical · magnifying-glass icon live · all /nexapp/* pages reachable.");
  process.exit(0);
}
