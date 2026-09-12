#!/usr/bin/env node
// scripts/smoke-observatory-gaps.mjs
//
// Founder Path A · OBS-4 · gap-tickets drill-down regression.
//
// Verifies:
//   A · snapshot returns domain_gaps array
//   B · when open gaps exist · at least one domain has open_gap_count > 0
//   C · top_gaps rows have shape (entity_ref, intent_slug, times_seen, source)
//   D · times_seen ordered descending in top_gaps
//   E · oldest_open_age_days is a number when open gaps exist
//   F · dashboard page still renders 200

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(path) {
  const res = await fetch(`${HOST}${path}`);
  return { status: res.status, body: res.headers.get("content-type")?.includes("application/json") ? await res.json() : await res.text() };
}

const failures = [];

// ══ A · snapshot has domain_gaps
console.log("\n══ A · snapshot returns domain_gaps array");
{
  const r = await get("/api/nex/observatory/snapshot?window=24h");
  console.log(`  count=${r.body?.domain_gaps?.length}`);
  if (!Array.isArray(r.body?.domain_gaps)) failures.push({ case: "A", reason: "no_domain_gaps_array" });
}

// ══ B · at least one domain has open gaps (test-run created gap tickets)
console.log("\n══ B · at least one domain has open_gap_count > 0");
{
  const r = await get("/api/nex/observatory/snapshot?window=24h");
  const gaps = r.body?.domain_gaps ?? [];
  const withOpen = gaps.filter((d) => d.open_gap_count > 0);
  console.log(`  domains_with_open=${withOpen.length} first_count=${withOpen[0]?.open_gap_count}`);
  if (withOpen.length === 0) failures.push({ case: "B", reason: "no_open_gaps" });
}

// ══ C · top_gaps shape
console.log("\n══ C · top_gaps shape valid");
{
  const r = await get("/api/nex/observatory/snapshot?window=24h");
  const gaps = r.body?.domain_gaps ?? [];
  let checked = 0;
  for (const d of gaps) {
    for (const g of d.top_gaps ?? []) {
      checked++;
      if (typeof g.entity_ref !== "string") failures.push({ case: "C", reason: `no_entity_ref_in_${d.domain}` });
      if (typeof g.intent_slug !== "string") failures.push({ case: "C", reason: `no_intent_slug_in_${d.domain}` });
      if (typeof g.times_seen !== "number") failures.push({ case: "C", reason: `no_times_seen_in_${d.domain}` });
      if (typeof g.source !== "string") failures.push({ case: "C", reason: `no_source_in_${d.domain}` });
      if (typeof g.first_seen_at !== "string") failures.push({ case: "C", reason: `no_first_seen_at_in_${d.domain}` });
    }
  }
  console.log(`  checked=${checked} top-gap rows`);
}

// ══ D · times_seen sorted descending
console.log("\n══ D · top_gaps sorted by times_seen desc");
{
  const r = await get("/api/nex/observatory/snapshot?window=24h");
  const gaps = r.body?.domain_gaps ?? [];
  for (const d of gaps) {
    const arr = d.top_gaps ?? [];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].times_seen > arr[i - 1].times_seen) {
        failures.push({ case: "D", reason: `unsorted_in_${d.domain}_at_${i}` });
      }
    }
  }
  console.log(`  order valid across ${gaps.length} domains`);
}

// ══ E · oldest_open_age_days is a number when gaps exist
console.log("\n══ E · oldest_open_age_days is a number when gaps exist");
{
  const r = await get("/api/nex/observatory/snapshot?window=24h");
  const gaps = r.body?.domain_gaps ?? [];
  for (const d of gaps) {
    if (d.open_gap_count > 0 && typeof d.oldest_open_age_days !== "number") {
      failures.push({ case: "E", reason: `no_oldest_days_in_${d.domain}_with_${d.open_gap_count}_gaps` });
    }
  }
  console.log(`  all domains with open gaps have oldest_open_age_days`);
}

// ══ F · dashboard page renders 200
console.log("\n══ F · dashboard page renders 200");
{
  const r = await get("/nex/observatory");
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "F", reason: `status_${r.status}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Observatory gap drill-down live · real customer-demand-ranked gaps surfaced.");
  process.exit(0);
}
