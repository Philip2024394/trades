#!/usr/bin/env node
// scripts/nex-canonical/build-food-ambiguity-review-2026-10-12.mjs
//
// Founder-authorised 2026-10-12 execution-pass-4 output.
//
// What this script is: a read-only review-queue builder. It reads the
// 115 unlinked food candidates whose approved-write was refused by the
// sealed `precheckHandoff` with `resolver_ambiguous`, and for each one
// enumerates:
//   - the candidate's name / city / coordinates / OSM id / website
//   - all `nex.business_canonical` rows with the same name_canonical
//     and city (lifecycle VERIFIED / OWNER_CLAIMED / OWNER_VERIFIED)
//   - haversine distance from the candidate to each existing canonical
//   - a draft recommendation (merge-into-existing / create-new-branch /
//     needs-human) with reasons
//
// What this script is NOT:
//   - It does NOT approve, reject, merge, write a canonical, or write
//     evidence. Zero DB mutations.
//   - It does NOT touch nex.source_registry.
//   - It does NOT touch checkpoints.jsonl or decisions.jsonl.
//   - It does NOT bypass the sealed `precheckHandoff` gate. The gate
//     already refused these. This report exists to give the founder
//     an evidence-backed queue for the manual decision each case
//     requires.
//
// Output:
//   - data/nex-canonical/pass4-food-ambiguity-review.jsonl (one JSON
//     object per candidate · full evidence)
//   - docs/nex-directory-food-ambiguity-review-2026-10-12.md
//     (human-readable summary)
//
// Rollback: delete the two output files.

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ALLOWLIST = "data/nex-canonical/pass4-allowlist-food-115.txt";
const PENDING = "data/nex-canonical/pending-review.jsonl";
const OUT_JSONL = "data/nex-canonical/pass4-food-ambiguity-review.jsonl";
const OUT_MD = "docs/nex-directory-food-ambiguity-review-2026-10-12.md";

const TOLERANCE_MERGE_M = 100;        // < 100 m from existing: strong duplicate signal
const TOLERANCE_BRANCH_M = 2000;      // > 2 km from any existing: likely a new chain branch

function haversineMeters(a, b) {
  if (!a || !b || typeof a.lat !== "number" || typeof b.lat !== "number") return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const allowCids = new Set(readFileSync(ALLOWLIST, "utf8").trim().split(",").map((s) => s.trim()).filter(Boolean));

  // 1 · Index pending-review entries by candidate_id (keep first occurrence).
  const byCid = new Map();
  const pLines = readFileSync(PENDING, "utf8").split("\n");
  for (const l of pLines) {
    if (!l) continue;
    let r; try { r = JSON.parse(l); } catch { continue; }
    const cand = r?.review_package?.candidates?.[0];
    if (!cand || !allowCids.has(cand.candidate_id)) continue;
    if (byCid.has(cand.candidate_id)) continue;
    byCid.set(cand.candidate_id, cand);
  }

  const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");

  // 2 · Group candidates by (name_canonical, city) to minimise lookups.
  const groupKey = (c) => `${(c.identity?.name_canonical || "").trim()}|${(c.identity?.city || "").trim()}`;
  const groups = new Map();
  for (const [, cand] of byCid) {
    const k = groupKey(cand);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(cand);
  }

  const results = [];
  const bucketCounts = {
    duplicate_strong: 0,          // nearest existing < 100 m
    duplicate_candidate: 0,       // nearest 100-500 m
    unclear: 0,                   // nearest 500-2000 m
    likely_new_branch: 0,         // nearest > 2000 m
    singleton: 0,                 // no same-name in city
    cannot_geo: 0,                // candidate has no coordinates
  };

  for (const [, group] of groups) {
    const first = group[0];
    const name = first.identity?.name_canonical;
    const city = first.identity?.city;
    const matches = (await client.query(
      `SELECT canonical_business_id, name_canonical, city,
              ST_X(coordinates::geometry) AS lng, ST_Y(coordinates::geometry) AS lat,
              lifecycle_state
         FROM nex.business_canonical
        WHERE name_canonical = $1 AND city = $2
          AND lifecycle_state IN ('VERIFIED','OWNER_CLAIMED','OWNER_VERIFIED')`,
      [name, city],
    )).rows;

    for (const cand of group) {
      const coords = cand.identity?.coordinates;
      let nearest = null;
      for (const m of matches) {
        if (typeof m.lat !== "number" || typeof m.lng !== "number") continue;
        const d = haversineMeters(coords && { lat: coords.lat, lng: coords.lng }, { lat: m.lat, lng: m.lng });
        if (!nearest || d < nearest.distance_m) nearest = { ...m, distance_m: isFinite(d) ? Math.round(d) : null };
      }

      let bucket, recommendation, reason;
      if (!coords) {
        bucket = "cannot_geo";
        recommendation = matches.length ? "needs-human (no coordinates, cannot auto-disambiguate)" : "needs-human (no coordinates, no same-name canonical)";
        reason = "candidate has no coordinates";
      } else if (matches.length === 0) {
        bucket = "singleton";
        recommendation = "approve as new canonical (safe)";
        reason = "no same-name canonical exists in this city";
      } else if (nearest?.distance_m != null && nearest.distance_m < TOLERANCE_MERGE_M) {
        bucket = "duplicate_strong";
        recommendation = `merge into canonical ${nearest.canonical_business_id}`;
        reason = `nearest existing is ${nearest.distance_m} m away (same name + city)`;
      } else if (nearest?.distance_m != null && nearest.distance_m < 500) {
        bucket = "duplicate_candidate";
        recommendation = "needs-human (possibly same business, possibly adjacent branch)";
        reason = `nearest existing is ${nearest.distance_m} m away`;
      } else if (nearest?.distance_m != null && nearest.distance_m < TOLERANCE_BRANCH_M) {
        bucket = "unclear";
        recommendation = "needs-human (could be close branch, could be duplicate)";
        reason = `nearest existing is ${nearest.distance_m} m away`;
      } else {
        bucket = "likely_new_branch";
        recommendation = "approve as new canonical (likely chain branch)";
        reason = `nearest existing is ${nearest?.distance_m ?? "∞"} m away (> ${TOLERANCE_BRANCH_M} m)`;
      }
      bucketCounts[bucket]++;
      results.push({
        candidate_id: cand.candidate_id,
        name,
        city,
        coords,
        osm_id: cand.identity?.osm_id,
        website_apex: cand.identity?.website_apex,
        phone_e164: cand.identity?.phone_e164,
        legacy_internal_id: cand.legacy_source?.internal_id,
        matches_count: matches.length,
        nearest_canonical_id: nearest?.canonical_business_id ?? null,
        nearest_distance_m: nearest?.distance_m ?? null,
        bucket,
        reason,
        recommendation,
      });
    }
  }

  await client.end();

  mkdirSync("data/nex-canonical", { recursive: true });
  mkdirSync("docs", { recursive: true });
  writeFileSync(OUT_JSONL, results.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const sections = ["# NEX Directory · Food ambiguity review · 2026-10-12", "",
    `**Subject set**: 115 \`nex.food_business\` rows (country=ID) whose approved candidates were refused by \`precheckHandoff\` with \`resolver_ambiguous\`.`,
    "**Mechanism**: name + city match against `nex.business_canonical` (VERIFIED/OWNER_CLAIMED/OWNER_VERIFIED), haversine distance from candidate coordinates to each match.",
    "**No DB writes made.**",
    "", "## Bucket distribution", "",
    "| Bucket | Count | Recommendation |",
    "|---|---|---|",
    `| singleton | ${bucketCounts.singleton} | approve as new canonical (safe) |`,
    `| likely_new_branch | ${bucketCounts.likely_new_branch} | approve as new canonical (chain branch > 2 km from any existing) |`,
    `| duplicate_strong | ${bucketCounts.duplicate_strong} | merge into existing canonical (< 100 m, same name) |`,
    `| duplicate_candidate | ${bucketCounts.duplicate_candidate} | needs-human (100–500 m window) |`,
    `| unclear | ${bucketCounts.unclear} | needs-human (500 m–2 km window) |`,
    `| cannot_geo | ${bucketCounts.cannot_geo} | needs-human (no coordinates) |`,
    "", "## Per-candidate detail · top 20 per bucket", "",
  ];

  const buckets = ["singleton", "likely_new_branch", "duplicate_strong", "duplicate_candidate", "unclear", "cannot_geo"];
  for (const b of buckets) {
    const rows = results.filter((r) => r.bucket === b);
    if (rows.length === 0) continue;
    sections.push(`### ${b} (${rows.length})`, "", "| Name | City | Nearest existing (m) | Existing count | Recommendation |", "|---|---|---|---|---|");
    for (const r of rows.slice(0, 20)) {
      sections.push(`| ${r.name} | ${r.city} | ${r.nearest_distance_m ?? "—"} | ${r.matches_count} | ${r.recommendation} |`);
    }
    sections.push("");
  }

  sections.push("## Artifact paths", "", `- JSONL (full evidence per candidate): \`${OUT_JSONL}\``, `- This document: \`${OUT_MD}\``, `- Allowlist file: \`${ALLOWLIST}\``, `- Pipeline refusal log (precheck_blocked): \`data/nex-canonical/pass4-write-result.txt\``);

  writeFileSync(OUT_MD, sections.join("\n"));
  console.log(JSON.stringify({ phase: "done", total: results.length, bucket_counts: bucketCounts, artifacts: [OUT_JSONL, OUT_MD] }));
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
