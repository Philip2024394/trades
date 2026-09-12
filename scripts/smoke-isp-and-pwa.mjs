#!/usr/bin/env node
// scripts/smoke-isp-and-pwa.mjs
//
// Founder ISP-1 + PWA-1 · regression.
//
// Verifies:
//   A · GET /api/nex/isp-status?country=ID returns shape (disabled by
//        default via NEX_ISP_STATUS · so entries may be empty)
//   B · GET /api/nex/isp-status honors the country param
//   C · GET /nex-sw.js returns the service worker script (200 + JS)
//   D · GET /nex-manifest.json returns valid PWA manifest
//   E · GET /nex/pwa returns the SW installer page

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(path) {
  const res = await fetch(`${HOST}${path}`);
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") ?? "" };
}
async function getJson(path) {
  const r = await get(path);
  try { return { status: r.status, body: JSON.parse(r.text) }; }
  catch { return { status: r.status, body: null }; }
}

const failures = [];

console.log("\n══ A · isp-status endpoint valid shape");
{
  const r = await getJson("/api/nex/isp-status?country=ID");
  console.log(`  status=${r.status} country=${r.body?.country} entry_count=${r.body?.entries?.length}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (r.body?.country !== "ID") failures.push({ case: "A", reason: `country_${r.body?.country}` });
  if (!Array.isArray(r.body?.entries)) failures.push({ case: "A", reason: "no_entries_array" });
}

console.log("\n══ B · isp-status honors country param");
{
  const r = await getJson("/api/nex/isp-status?country=gb");
  console.log(`  status=${r.status} country=${r.body?.country}`);
  if (r.body?.country !== "GB") failures.push({ case: "B", reason: `country_${r.body?.country}` });
}

console.log("\n══ C · service worker script accessible");
{
  const r = await get("/nex-sw.js");
  console.log(`  status=${r.status} content-type=${r.contentType.slice(0, 50)}`);
  if (r.status !== 200) failures.push({ case: "C", reason: `status_${r.status}` });
  if (!r.text.includes("CACHE_NAME") || !r.text.includes("nex-lcc")) {
    failures.push({ case: "C", reason: "sw_markers_missing" });
  }
}

console.log("\n══ D · PWA manifest valid");
{
  const r = await getJson("/nex-manifest.json");
  console.log(`  status=${r.status} name=${r.body?.name}`);
  if (r.status !== 200) failures.push({ case: "D", reason: `status_${r.status}` });
  if (r.body?.name !== "NEX") failures.push({ case: "D", reason: `name_${r.body?.name}` });
  if (!Array.isArray(r.body?.icons)) failures.push({ case: "D", reason: "no_icons" });
}

console.log("\n══ E · SW installer page renders");
{
  const r = await get("/nex/pwa");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "E", reason: `status_${r.status}` });
  if (!r.text.includes("NEX · Offline Cache") && !r.text.includes("Offline")) {
    failures.push({ case: "E", reason: "no_marker" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · ISP outage awareness + PWA offline cache live.");
  process.exit(0);
}
