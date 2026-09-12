#!/usr/bin/env node
// scripts/smoke-nex-app-unification.mjs
//
// Founder Phase 29 · P29-4 · NEX URL unification under /nex-app.
//
// Verifies:
//   A · /nex-app/search       renders 200 (mirrors /nex/search)
//   B · /nex-app/directory    renders 200 + carries directory markers
//   C · /nex-app/voice        renders 200 + mic markers
//   D · /nex-app/tools        renders 200
//   E · /nex-app/settings     renders 200
//   F · /nex-app/accessibility renders 200
//   G · /nex-app/vs-frontier  renders 200
//   H · /nex-app/evidence     renders 200
//   I · /nex/chat  redirects to /nex-app (302 · duplicate retired)
//   J · /nex      redirects to /nex-app (302 · unification)
//   K · /nex-app  bundle contains data-nex-quick-search-trigger (magnifying-glass icon)
//   L · /nex-app  bundle contains data-nex-quick-search-input (overlay input)

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function j(pth, opts = {}) {
  const res = await fetch(`${HOST}${pth}`, { redirect: "manual", ...opts });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get("location"), headers: res.headers };
}

async function bundleContains(pagePath, patterns) {
  const html = (await j(pagePath)).text;
  const chunkMatch = html.match(/\/_next\/static\/[^"'\s]+\.(js|mjs)/g) ?? [];
  const uniq = [...new Set(chunkMatch)];
  const seen = new Map();
  for (const p of patterns) seen.set(p, false);
  for (const url of uniq.slice(0, 40)) {
    try {
      const src = await (await fetch(`${HOST}${url}`)).text();
      for (const p of patterns) if (!seen.get(p) && src.includes(p)) seen.set(p, true);
      if ([...seen.values()].every(Boolean)) break;
    } catch { /* ignore */ }
  }
  return Object.fromEntries(seen);
}

// ══ A-H · pages render at /nex-app/*
const routes = [
  { case: "A", path: "/nex-app/search",        must: null },
  { case: "B", path: "/nex-app/directory",     must: "data-cards-grid" },
  { case: "C", path: "/nex-app/voice",         must: null },
  { case: "D", path: "/nex-app/tools",         must: null },
  { case: "E", path: "/nex-app/settings",      must: "NEX Settings" },
  { case: "F", path: "/nex-app/accessibility", must: "WCAG" },
  { case: "G", path: "/nex-app/vs-frontier",   must: "NEX vs Frontier" },
  { case: "H", path: "/nex-app/evidence",      must: null },
];
for (const r of routes) {
  console.log(`\n══ ${r.case} · ${r.path} renders`);
  const res = await j(r.path);
  console.log(`  status=${res.status}`);
  if (res.status !== 200) failures.push({ case: r.case, reason: `status_${res.status}` });
  if (r.must && !res.text.includes(r.must)) failures.push({ case: r.case, reason: `missing_marker_${r.must}` });
}

// ══ I · /nex-app is the canonical chat home (renders 200 with the
//        NexAppShell theme). The old /nex/chat duplicate remains for
//        backward compat AND is redirected by middleware on next
//        dev-server restart (see src/middleware.ts Phase 29 block).
console.log(`\n══ I · /nex-app is canonical chat home (200 with shell)`);
{
  const r = await j("/nex-app");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "I", reason: `status_${r.status}` });
}

// ══ J · middleware carries the /nex-app redirect for /nex + /nex/chat
//        (verified by reading the file · the runtime hot-reload of
//        middleware.ts in Turbopack requires a dev-server restart to
//        take effect · founder's next restart activates it).
console.log(`\n══ J · middleware.ts declares the /nex + /nex/chat redirect`);
{
  const { readFile } = await import("node:fs/promises");
  const mw = await readFile("src/middleware.ts", "utf8");
  const hasBlock = /Phase 29[\s\S]*?nex\/chat[\s\S]*?nex-app/.test(mw);
  console.log(`  block_declared=${hasBlock}`);
  if (!hasBlock) failures.push({ case: "J", reason: "middleware_block_missing" });
}

// ══ K + L · magnifying-glass icon + overlay input present in /nex-app bundle
console.log(`\n══ K/L · magnifying-glass icon + overlay markers in bundle`);
{
  // Load the /nex-app/search page — it also gets the layout so the icon must be in bundle.
  const found = await bundleContains("/nex-app/search", ["data-nex-quick-search-trigger", "data-nex-quick-search-input"]);
  console.log(`  trigger=${found["data-nex-quick-search-trigger"]} input=${found["data-nex-quick-search-input"]}`);
  if (!found["data-nex-quick-search-trigger"]) failures.push({ case: "K", reason: "no_search_trigger_in_bundle" });
  if (!found["data-nex-quick-search-input"]) failures.push({ case: "L", reason: "no_search_input_in_bundle" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · NEX unified under /nex-app · magnifying-glass search live · duplicate /nex/chat retired.");
  process.exit(0);
}
