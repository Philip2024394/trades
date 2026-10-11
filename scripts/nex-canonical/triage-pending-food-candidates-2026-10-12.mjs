#!/usr/bin/env node
// scripts/nex-canonical/triage-pending-food-candidates-2026-10-12.mjs
//
// Founder-authorised 2026-10-12 execution pass 3 · "Resolve the 126
// food candidates systematically" without blindly approving.
//
// READ-ONLY: no DB writes, no pending-review.jsonl writes, no
// decisions.jsonl writes. Produces a committable analysis artifact at
// data/nex-canonical/food-triage-2026-10-12.json plus a human-readable
// summary at docs/nex-directory-food-triage-2026-10-12.md.
//
// Approach:
//   1. Load every food candidate from pending-review.jsonl with
//      status='pending_founder_review'. Dedupe by candidate_id.
//   2. Exclude candidate_ids that already have a decision record in
//      decisions.jsonl (they're resolved, just not yet promoted or
//      failed the write stage).
//   3. For each remaining candidate query nex.business_canonical for
//      same name_canonical + same city.
//   4. If existing canonical(s) found, compute haversine distance
//      from the candidate's coordinates to each one. Classify by
//      nearest distance:
//        < 100 m   → likely_duplicate  (reject-worthy)
//        > 2000 m  → likely_new_branch (approve-worthy; chain branch)
//        other     → human_review     (truly ambiguous)
//      If no same-name canonical in city → singleton_unique (also
//      approve-worthy, no ambiguity).
//      If candidate has no coordinates → cannot_geo_resolve.
//   5. Produce bucket counts + per-candidate detail.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const PENDING = "data/nex-canonical/pending-review.jsonl";
const DECISIONS = "data/nex-canonical/decisions.jsonl";
const OUT_JSON = "data/nex-canonical/food-triage-2026-10-12.json";
const OUT_MD = "docs/nex-directory-food-triage-2026-10-12.md";

function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function classify(nearestMeters) {
  if (!isFinite(nearestMeters)) return "cannot_geo_resolve";
  if (nearestMeters < 100) return "likely_duplicate";
  if (nearestMeters > 2000) return "likely_new_branch";
  return "human_review";
}

async function main() {
  // 1 · Load decision-record candidate_ids (set of resolved IDs).
  const decided = new Set();
  if (existsSync(DECISIONS)) {
    const dLines = readFileSync(DECISIONS, "utf8").split("\n");
    for (const l of dLines) {
      if (!l) continue;
      try { const r = JSON.parse(l); if (r.candidate_id) decided.add(r.candidate_id); } catch {}
    }
  }
  console.log(JSON.stringify({ phase: "decided-count", n: decided.size }));

  // 2 · Load unique food pending candidates with status pending_founder_review.
  const foodById = new Map();
  const lines = readFileSync(PENDING, "utf8").split("\n");
  for (const l of lines) {
    if (!l) continue;
    let r;
    try { r = JSON.parse(l); } catch { continue; }
    const cand = r?.review_package?.candidates?.[0];
    if (!cand) continue;
    if (cand.legacy_source?.table !== "nex.food_business") continue;
    if (cand.status !== "pending_founder_review") continue;
    if (foodById.has(cand.candidate_id)) continue;
    if (decided.has(cand.candidate_id)) continue;
    foodById.set(cand.candidate_id, cand);
  }
  console.log(JSON.stringify({ phase: "food-pending-unique", n: foodById.size }));

  // 3 · Query canonical name/city matches in batched fashion.
  const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");

  const bucketCounts = {
    likely_duplicate: 0,
    likely_new_branch: 0,
    singleton_unique: 0,
    human_review: 0,
    cannot_geo_resolve: 0,
  };
  const details = [];

  // Deduplicate by (name_canonical, city) tuple to minimise queries.
  const nameCityKey = (c) => `${(c.identity?.name_canonical || "").trim().toLowerCase()}|${(c.identity?.city || "").trim().toLowerCase()}`;
  const groupMap = new Map();
  for (const [cid, cand] of foodById) {
    const k = nameCityKey(cand);
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(cand);
  }

  for (const [key, group] of groupMap) {
    const first = group[0];
    const name = first.identity?.name_canonical;
    const city = first.identity?.city;
    const matches = (await client.query(
      `SELECT canonical_business_id, name_canonical, city,
              ST_X(coordinates::geometry) AS lng, ST_Y(coordinates::geometry) AS lat,
              lifecycle_state
         FROM nex.business_canonical
        WHERE name_canonical = $1 AND city = $2 AND lifecycle_state IN ('VERIFIED','OWNER_CLAIMED','OWNER_VERIFIED')`,
      [name, city],
    )).rows;

    for (const cand of group) {
      const coords = cand.identity?.coordinates;
      let nearestMeters = Infinity;
      let nearestId = null;
      if (coords && matches.length > 0) {
        for (const m of matches) {
          if (typeof m.lat === "number" && typeof m.lng === "number") {
            const d = haversineMeters({ lat: coords.lat, lng: coords.lng }, { lat: m.lat, lng: m.lng });
            if (d < nearestMeters) { nearestMeters = d; nearestId = m.canonical_business_id; }
          }
        }
      }
      let bucket;
      if (matches.length === 0) bucket = coords ? "singleton_unique" : "cannot_geo_resolve";
      else bucket = classify(nearestMeters);
      bucketCounts[bucket]++;
      details.push({
        candidate_id: cand.candidate_id,
        name,
        city,
        coords: coords || null,
        legacy_internal_id: cand.legacy_source?.internal_id,
        existing_canonicals_in_city: matches.length,
        nearest_canonical_id: nearestId,
        nearest_meters: isFinite(nearestMeters) ? Math.round(nearestMeters) : null,
        bucket,
        recommendation: {
          likely_duplicate: `reject · nearest existing canonical ${Math.round(nearestMeters)}m away`,
          likely_new_branch: `approve as new branch · nearest existing ${Math.round(nearestMeters)}m away`,
          singleton_unique: "approve as new canonical · no same-name businesses in this city",
          human_review: `human-review · nearest existing ${Math.round(nearestMeters)}m away (100-2000m window)`,
          cannot_geo_resolve: matches.length === 0 ? "approve as new canonical · but no coordinates to verify" : "human-review · no coordinates to disambiguate from existing match",
        }[bucket],
      });
    }
  }
  await client.end();

  mkdirSync("data/nex-canonical", { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify({ generated_at: new Date().toISOString(), bucket_counts: bucketCounts, details }, null, 2));

  // Markdown summary
  const by_bucket = details.reduce((a, d) => { (a[d.bucket] = a[d.bucket] || []).push(d); return a; }, {});
  const md = [
    "# NEX Directory · Food candidate triage · 2026-10-12",
    "",
    "**Scope**: `pending_founder_review` food candidates in `data/nex-canonical/pending-review.jsonl`",
    "**Mechanism**: name + city match against `nex.business_canonical` (lifecycle VERIFIED/OWNER_CLAIMED/OWNER_VERIFIED), haversine distance to nearest existing canonical.",
    "",
    "## Bucket counts",
    "",
    "| Bucket | Count | Recommendation |",
    "|---|---|---|",
    `| likely_duplicate | ${bucketCounts.likely_duplicate} | reject (same-name canonical < 100 m) |`,
    `| likely_new_branch | ${bucketCounts.likely_new_branch} | approve (same name > 2 km from any existing) |`,
    `| singleton_unique | ${bucketCounts.singleton_unique} | approve (no same-name canonical in city) |`,
    `| human_review | ${bucketCounts.human_review} | human review (100 m–2 km window or chain cluster) |`,
    `| cannot_geo_resolve | ${bucketCounts.cannot_geo_resolve} | human review (no coordinates) |`,
    "",
    "## Top 20 by bucket",
    "",
  ];
  for (const b of ["likely_duplicate", "likely_new_branch", "singleton_unique", "human_review", "cannot_geo_resolve"]) {
    const rows = (by_bucket[b] || []).slice(0, 20);
    if (rows.length === 0) continue;
    md.push(`### ${b} (${(by_bucket[b] || []).length})`);
    md.push("");
    md.push("| Name | City | Nearest (m) | Existing count | Candidate ID |");
    md.push("|---|---|---|---|---|");
    for (const r of rows) {
      md.push(`| ${r.name} | ${r.city} | ${r.nearest_meters ?? "—"} | ${r.existing_canonicals_in_city} | \`${r.candidate_id}\` |`);
    }
    md.push("");
  }
  mkdirSync("docs", { recursive: true });
  writeFileSync(OUT_MD, md.join("\n"));

  console.log(JSON.stringify({ phase: "done", bucket_counts: bucketCounts, total: details.length, artifacts: [OUT_JSON, OUT_MD] }));
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
