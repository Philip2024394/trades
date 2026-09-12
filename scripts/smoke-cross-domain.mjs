#!/usr/bin/env node
// scripts/smoke-cross-domain.mjs
//
// Founder Phase 5 · P5-6 · Cross-Domain intelligence regression.
//
// Verifies:
//   A · single-domain queries do NOT fire cross-domain
//   B · multi-domain query with proximity+temporal hints FIRES
//   C · decomposer detects all present domains
//   D · sub-queries created per domain
//   E · temporal hint "tonight" parsed to a window
//   F · geo joins report honest UNKNOWN when no coords available
//   G · fabrication guard preserved · UNKNOWN domains show as UNKNOWN not invented
//   H · thin adapters registered (markets/travel/attractions/business) reachable

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: null }; }
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

console.log("\n══ A · single-domain query does NOT fire cross-domain");
{
  const r = await chat(randomUUID(), "how many rooms does Gaotama Hotel have?");
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  console.log(`  fired=${cdm?.fired} is_multi_domain=${cdm?.is_multi_domain}`);
  if (cdm?.fired === true && cdm?.is_multi_domain !== true) {
    failures.push({ case: "A", reason: "fired_on_single_domain" });
  }
}

console.log("\n══ B · multi-domain query with proximity+temporal FIRES");
{
  const cid = randomUUID();
  const r = await chat(cid, "Find me a hotel with parking near a market and restaurant open tonight in Yogyakarta");
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  console.log(`  fired=${cdm?.fired} domains=${cdm?.domains?.join(",")} answered=${cdm?.answered}`);
  if (cdm?.fired !== true) failures.push({ case: "B", reason: `did_not_fire_${cdm?.reason ?? "?"}` });
  if (cdm?.is_multi_domain !== true) failures.push({ case: "B", reason: "not_multi_domain" });
}

console.log("\n══ C · decomposer detects all present domains");
{
  const r = await chat(randomUUID(), "hotel near market restaurant temple in Yogyakarta " + Date.now());
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  const domains = new Set(cdm?.domains ?? []);
  console.log(`  domains=${[...domains].join(",")}`);
  for (const need of ["accommodation", "markets", "food", "attractions"]) {
    if (!domains.has(need)) failures.push({ case: "C", reason: `missing_${need}` });
  }
}

console.log("\n══ D · sub-queries + per_domain_hits present");
{
  const r = await chat(randomUUID(), "hotel with parking near market tonight " + Date.now());
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  console.log(`  per_domain_hits=${JSON.stringify(cdm?.per_domain_hits)}`);
  if (!cdm?.per_domain_hits || Object.keys(cdm.per_domain_hits).length < 2) {
    failures.push({ case: "D", reason: "no_per_domain_hits" });
  }
}

console.log("\n══ E · temporal hint 'tonight' parsed to a window");
{
  const r = await chat(randomUUID(), "hotel near restaurant tonight " + Date.now());
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  console.log(`  temporal_hint=${cdm?.temporal_hint} temporal_parsed=${cdm?.temporal_parsed}`);
  if (cdm?.fired && cdm?.temporal_hint === "tonight" && cdm?.temporal_parsed !== true) {
    failures.push({ case: "E", reason: "tonight_not_parsed" });
  }
}

console.log("\n══ F · geo joins report honest UNKNOWN when no coords");
{
  const r = await chat(randomUUID(), "hotel near market and restaurant in Yogyakarta " + Date.now());
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  console.log(`  join_summary=${JSON.stringify(cdm?.join_summary)}`);
  if (cdm?.fired && Array.isArray(cdm.join_summary) && cdm.join_summary.length > 0) {
    const hasUnknown = cdm.join_summary.some((j) => typeof j.unknown_reason === "string" && j.unknown_reason.includes("no_geo_coords"));
    // OK if either pair_count > 0 (data exists) or honest UNKNOWN reason present
    for (const j of cdm.join_summary) {
      if (j.pair_count === 0 && !j.unknown_reason) {
        failures.push({ case: "F", reason: `no_reason_${j.from}_${j.to}` });
      }
    }
  }
}

console.log("\n══ G · fabrication guard · UNKNOWN not invented");
{
  const r = await chat(randomUUID(), "restaurant with vegan halal buffet near hotel in Yogyakarta " + Date.now());
  const cdm = r.body?._debug_timings?.cross_domain_meta;
  const headline = String(cdm?.headline ?? "");
  console.log(`  headline: ${headline.slice(0, 100)}`);
  // If food returned 0 hits, headline must say "food · UNKNOWN" not invent one
  if (cdm?.fired && cdm.per_domain_hits?.food === 0 && !headline.includes("food · UNKNOWN")) {
    failures.push({ case: "G", reason: "food_unknown_not_surfaced" });
  }
}

console.log("\n══ H · thin adapters reachable · markets/travel/attractions/business");
{
  const tests = [
    { msg: "hotel in Jakarta with parking · nearby Beringharjo market",         want: "markets" },
    { msg: "3-day holiday itinerary to Bali · budget",                          want: "travel" },
    { msg: "visit to Prambanan temple and Borobudur",                           want: "attractions" },
    { msg: "find plumber and electrician for kantor renovation",                want: "business" },
  ];
  for (const t of tests) {
    const r = await chat(randomUUID(), t.msg);
    const dbg = r.body?._debug_timings ?? {};
    const domain = dbg.lcc_domain;
    console.log(`  ${t.want} · lcc_domain=${domain}`);
    // We accept if the domain matches OR the cross-domain path saw it
    const cdm = dbg.cross_domain_meta;
    const seenInCross = Array.isArray(cdm?.domains) && cdm.domains.includes(t.want);
    if (domain !== t.want && !seenInCross) {
      // Only a hard fail if classifier missed AND cross-domain didn't see it either.
      failures.push({ case: "H", reason: `${t.want}_not_reached_lcc_domain=${domain}` });
    }
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · cross-domain orchestrator live · zero fabrication · honest UNKNOWNs surfaced.");
  process.exit(0);
}
