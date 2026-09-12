#!/usr/bin/env node
// scripts/smoke-observatory-page.mjs
//
// Founder Path A · OBS-3-2 · Observatory HTML dashboard smoke.
//
// Verifies:
//   A · GET /nex/observatory returns 200 · marker attribute present
//   B · snapshot endpoint honours ?window=1h · 24h · 7d · 30d
//   C · snapshot shape contains doctrine + groundedness + latency + alerts
//   D · doctrine overall_score is a number in [0,1]

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(path) {
  const res = await fetch(`${HOST}${path}`, { headers: { "Cache-Control": "no-cache" } });
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") ?? "" };
}
async function getJson(path) {
  const r = await get(path);
  try { return { status: r.status, body: JSON.parse(r.text) }; }
  catch { return { status: r.status, body: { _parse_error: r.text.slice(0, 200) } }; }
}

const failures = [];

// ══ A · page renders 200 · marker
console.log("\n══ A · GET /nex/observatory returns 200 + marker");
{
  const r = await get("/nex/observatory");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!r.contentType.startsWith("text/html")) failures.push({ case: "A", reason: `bad_content_type_${r.contentType}` });
  // Server-rendered HTML contains the client-component chunk · assert marker string
  // OR the page title so we know the route responded with the dashboard.
  if (!r.text.includes("NEX Observatory") && !r.text.includes("observatory")) {
    failures.push({ case: "A", reason: "no_page_marker" });
  }
}

// ══ B · snapshot endpoint honours window
console.log("\n══ B · snapshot endpoint honours window param");
{
  for (const w of ["1h", "24h", "7d", "30d"]) {
    const r = await getJson(`/api/nex/observatory/snapshot?window=${w}`);
    console.log(`  window=${w} preset=${r.body?.window?.preset}`);
    if (r.body?.window?.preset !== w) failures.push({ case: "B", reason: `window_${w}_returned_${r.body?.window?.preset}` });
  }
}

// ══ C · snapshot shape
console.log("\n══ C · snapshot shape complete");
{
  const r = await getJson(`/api/nex/observatory/snapshot?window=24h`);
  const b = r.body ?? {};
  const missing = [];
  if (!b.doctrine_health) missing.push("doctrine_health");
  if (!b.groundedness) missing.push("groundedness");
  if (!b.latency) missing.push("latency");
  if (!Array.isArray(b.domain_coverage)) missing.push("domain_coverage");
  if (!Array.isArray(b.alerts)) missing.push("alerts");
  console.log(`  missing=${missing.length === 0 ? "none" : missing.join(",")}`);
  if (missing.length > 0) failures.push({ case: "C", reason: `missing_${missing.join(",")}` });
}

// ══ D · overall_score bounded
console.log("\n══ D · doctrine overall_score in [0,1]");
{
  const r = await getJson(`/api/nex/observatory/snapshot?window=24h`);
  const score = r.body?.doctrine_health?.overall_score;
  console.log(`  overall_score=${score}`);
  if (typeof score !== "number" || score < 0 || score > 1) {
    failures.push({ case: "D", reason: `bad_score_${score}` });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Observatory dashboard page + snapshot endpoint green.");
  process.exit(0);
}
