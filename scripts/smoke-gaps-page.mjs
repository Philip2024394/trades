#!/usr/bin/env node
// scripts/smoke-gaps-page.mjs
//
// Founder GAP-1 · gap-priority page regression.
//
// Verifies:
//   A · GET /nex/gaps returns 200
//   B · marker in HTML confirms it's the gaps page
//   C · snapshot endpoint still exposes domain_gaps (source of the page)

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(pathStr) {
  const res = await fetch(`${HOST}${pathStr}`);
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") ?? "" };
}

const failures = [];

// ══ A · page renders
console.log("\n══ A · GET /nex/gaps returns 200");
{
  const r = await get("/nex/gaps");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!r.contentType.startsWith("text/html")) failures.push({ case: "A", reason: `content_type_${r.contentType}` });
}

// ══ B · marker in HTML
console.log("\n══ B · marker text present");
{
  const r = await get("/nex/gaps");
  if (!r.text.includes("NEX Knowledge Gaps") && !r.text.includes("data-gaps-page")) {
    failures.push({ case: "B", reason: "no_marker_in_html" });
  }
}

// ══ C · snapshot source-of-truth still available
console.log("\n══ C · snapshot exposes domain_gaps");
{
  const r = await fetch(`${HOST}/api/nex/observatory/snapshot?window=7d`);
  const body = await r.json();
  console.log(`  domain_gaps_count=${body?.domain_gaps?.length}`);
  if (!Array.isArray(body?.domain_gaps)) failures.push({ case: "C", reason: "no_domain_gaps" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · gap-priority page live · founder can see customer-demand-ranked gaps.");
  process.exit(0);
}
