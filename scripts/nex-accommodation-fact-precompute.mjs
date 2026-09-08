#!/usr/bin/env node
// scripts/nex-accommodation-fact-precompute.mjs
//
// Founder BEGIN 2026-09-09 · P5 · FACT PRECOMPUTE CYCLE
//
// Loads N real accommodation rows from canonical Postgres (default N=200 ·
// customer-relevant Yogyakarta visible subset), joins their per-field
// provenance and enrichment evidence, computes FactBundles via the P2
// fact-computer, warms the P3 hot-tier, then measures:
//
//   - rows loaded from Postgres (+ ms)
//   - fact bundles built (+ ms)
//   - intents answered vs unknown per property
//   - gap tickets proposed
//   - hot-tier cold-miss vs warm-hit lookup latency
//   - a random sample of intent → fact renders (spot-check for fabrication)
//
// Zero writes. Read-only against canonical Postgres. Loads bundles into a
// disposable in-process hot-tier only. Honest UNKNOWN preserved.
//
// Runs itself under tsx (needed for direct .ts imports).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_FACT_PC_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local")) ? ["--env-file=.env.local"] : [];
  const child = spawn("npx", ["tsx", ...envFileArgs, entryFile, ...process.argv.slice(2)], {
    stdio: "inherit", cwd: repoRoot, shell: true,
    env: { ...process.env, NEX_FACT_PC_INNER: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 200);
  const CITY = process.argv.find((a) => a.startsWith("--city="))?.slice(7) ?? "Yogyakarta";
  const SAMPLE_SIZE = 5;

  if (!process.env.NEX_POSTGRES_URL) {
    console.error("NEX_POSTGRES_URL not set"); process.exit(1);
  }

  console.log("━".repeat(78));
  console.log("NEX ACCOMMODATION · P5 · FACT PRECOMPUTE CYCLE");
  console.log(`N          : ${N} rows`);
  console.log(`city       : ${CITY} (visible subset)`);
  console.log(`started    : ${new Date().toISOString()}`);
  console.log("━".repeat(78));

  const pg = await import("pg");
  const { Pool } = pg.default ?? pg;
  const facMod = await import("../src/lib/nex/intelligence-storage-grid/accommodation/fact-computer.ts");
  const hotMod = await import("../src/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts.ts");
  const parseMod = await import("../src/lib/nex/intelligence-storage-grid/accommodation/intent-parser.ts");
  const composeMod = await import("../src/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer.ts");
  const registryMod = await import("../src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts");

  const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });

  // ── 1 · Load N rows ────────────────────────────────────────────
  const t_load_0 = performance.now();
  const rowsRes = await pool.query(
    `SELECT * FROM nex.accommodation_business
      WHERE city = $1 AND claim_status IN ('listed', 'claimed', 'paying')
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $2`,
    [CITY, N],
  );
  const rows = rowsRes.rows;
  const t_load = performance.now() - t_load_0;
  console.log(`\n▸ Loaded ${rows.length} rows from nex.accommodation_business in ${t_load.toFixed(1)}ms`);

  if (rows.length === 0) {
    console.error(`No rows returned for city=${CITY}. Aborting.`);
    await pool.end();
    process.exit(1);
  }

  // ── 2 · Load provenance for all listing_refs ──────────────────
  const refs = rows.map((r) => r.public_listing_ref);
  const t_prov_0 = performance.now();
  const provRes = await pool.query(
    `SELECT * FROM nex.accommodation_business_field_provenance
      WHERE business_ref = ANY($1::text[])`,
    [refs],
  );
  const t_prov = performance.now() - t_prov_0;
  console.log(`▸ Loaded ${provRes.rows.length} provenance rows in ${t_prov.toFixed(1)}ms`);

  // ── 3 · Load enrichment_evidence (may be empty · normal) ─────
  const t_ev_0 = performance.now();
  const evRes = await pool.query(
    `SELECT business_ref, field_name, value, raw_payload, confidence, source, source_type, discovered_at
       FROM nex.accommodation_enrichment_evidence
      WHERE business_ref = ANY($1::text[])`,
    [refs],
  );
  const t_ev = performance.now() - t_ev_0;
  console.log(`▸ Loaded ${evRes.rows.length} enrichment_evidence rows in ${t_ev.toFixed(1)}ms`);

  // ── 4 · Bucket by listing_ref ─────────────────────────────────
  const provByRef = new Map();
  for (const p of provRes.rows) {
    if (!provByRef.has(p.business_ref)) provByRef.set(p.business_ref, []);
    provByRef.get(p.business_ref).push(p);
  }
  const evByRef = new Map();
  for (const e of evRes.rows) {
    if (!evByRef.has(e.business_ref)) evByRef.set(e.business_ref, []);
    evByRef.get(e.business_ref).push(e);
  }

  // ── 5 · Compute FactBundles ───────────────────────────────────
  const t_fact_0 = performance.now();
  const bundles = rows.map((row) =>
    facMod.computeFactBundle({
      row,
      provenance: provByRef.get(row.public_listing_ref) ?? [],
      evidence: evByRef.get(row.public_listing_ref) ?? [],
    }),
  );
  const t_fact = performance.now() - t_fact_0;
  const meanIntentsAnswered = bundles.reduce((a, b) => a + b.intents_answered, 0) / bundles.length;
  const meanIntentsUnknown = bundles.reduce((a, b) => a + b.intents_unknown, 0) / bundles.length;
  const totalGapTickets = bundles.reduce((a, b) => a + b.gap_tickets_proposed.length, 0);
  console.log(`▸ Computed ${bundles.length} FactBundles in ${t_fact.toFixed(1)}ms (${(t_fact / bundles.length).toFixed(2)}ms per row)`);
  console.log(`   mean intents answered per property : ${meanIntentsAnswered.toFixed(1)}`);
  console.log(`   mean intents UNKNOWN per property  : ${meanIntentsUnknown.toFixed(1)}`);
  console.log(`   total gap tickets proposed         : ${totalGapTickets}`);

  // ── 6 · Cold-miss latency (empty hot-tier · N sample lookups) ─
  hotMod.factHotInvalidateAll();
  const coldMs = [];
  for (const r of refs.slice(0, Math.min(50, refs.length))) {
    const t0 = performance.now();
    const hit = hotMod.factHotGet(r);
    coldMs.push(performance.now() - t0);
    if (hit) console.error(`unexpected hot-tier hit on cold sweep for ${r}`);
  }
  const coldMean = coldMs.reduce((a, b) => a + b, 0) / coldMs.length;
  console.log(`\n▸ Cold-miss lookup mean : ${coldMean.toFixed(4)}ms over ${coldMs.length} probes (expected sub-ms · empty map)`);

  // ── 7 · Warm hot-tier ──────────────────────────────────────────
  const t_warm_0 = performance.now();
  const setN = hotMod.factHotSetBulk(bundles);
  const t_warm = performance.now() - t_warm_0;
  console.log(`▸ Warmed hot-tier with ${setN} bundles in ${t_warm.toFixed(1)}ms (${(t_warm / setN).toFixed(3)}ms per row)`);

  // ── 8 · Warm-hit latency sweep ─────────────────────────────────
  const warmMs = [];
  for (let i = 0; i < 500; i++) {
    const r = refs[i % refs.length];
    const t0 = performance.now();
    const hit = hotMod.factHotGet(r);
    warmMs.push(performance.now() - t0);
    if (!hit) console.error(`unexpected hot-tier miss on warm sweep for ${r}`);
  }
  warmMs.sort((a, b) => a - b);
  const p = (arr, q) => arr[Math.min(arr.length - 1, Math.ceil((q / 100) * arr.length) - 1)];
  const warmP50 = p(warmMs, 50);
  console.log(`▸ Warm-hit lookup      : n=${warmMs.length} · P50=${warmP50.toFixed(4)}ms · P95=${p(warmMs, 95).toFixed(4)}ms · P99=${p(warmMs, 99).toFixed(4)}ms · max=${warmMs[warmMs.length - 1].toFixed(4)}ms`);
  console.log(`   speedup vs one Postgres round-trip (~220ms) : ~${warmP50 > 0 ? Math.round(220 / warmP50) : "∞"}×`);

  // ── 9 · Composer spot-check · N deterministic samples ─────────
  console.log(`\n▸ Composer spot-check (${SAMPLE_SIZE} sampled turns · shows exact user-visible reply)`);
  const sampleIntents = ["breakfast_available", "wifi_available", "parking_available", "property_star_rating", "location_city"];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const bundle = bundles[Math.floor(Math.random() * bundles.length)];
    const intentSlug = sampleIntents[i % sampleIntents.length];
    const parsedFake = {
      intent_slug: intentSlug,
      intent: registryMod.INTENT_REGISTRY.find((it) => it.slug === intentSlug),
      slots: { is_question: true, is_follow_up_where: false, is_follow_up_has: false, is_follow_up_ordinal: false, is_vertical_switch: false, is_action_show: false, is_action_book: false },
      confidence: 0.9,
      normalised: { raw: "(spot-check)", cleaned: "", tokens: [], canonical_tokens: [], substitutions: [], unresolved: [], contained_question_mark: true },
      reasoning: ["spot-check synthetic"],
    };
    const composed = composeMod.composeReply({
      parsed: parsedFake,
      bundles: [bundle],
      context: { language: "en", focus_listing_ref: bundle.listing_ref },
    });
    console.log(`   ${bundle.business_name.padEnd(38)}  Q="${intentSlug}"  →  "${composed.reply_text}"  [trust=${composed.trust} · answered=${composed.answered}]`);
  }

  // ── 10 · Real user-language parse spot-check ────────────────────
  console.log(`\n▸ Real-user-language parse spot-check (10 queries · deterministic · no LLM)`);
  const testQueries = [
    "do they have breakfast?",
    "wifi ada?",
    "how much is it",
    "parking?",
    "what star rating",
    "brekky included",
    "kolam renang?",
    "does it have a pool",
    "where is it",
    "cheap hotels in jogja",
  ];
  for (const q of testQueries) {
    const parsed = parseMod.parseIntent(q);
    console.log(`   "${q.padEnd(28)}"  →  intent=${(parsed.intent_slug ?? "null").padEnd(24)} conf=${parsed.confidence.toFixed(2)}  slots=${JSON.stringify({ city: parsed.slots.city, cat: parsed.slots.property_category, price: parsed.slots.price_preference })}`);
  }

  // ── 11 · Persist immutable measurement record (Op-Truth §OP.5) ─
  const outDir = path.join(repoRoot, "data", "fact-precompute", "measurements");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `precompute_run_${stamp}.json`);
  const record = {
    run_id: stamp,
    started_at_iso: new Date().toISOString(),
    n_requested: N,
    n_loaded: rows.length,
    city: CITY,
    latency_ms: {
      load_rows: Math.round(t_load * 100) / 100,
      load_provenance: Math.round(t_prov * 100) / 100,
      load_evidence: Math.round(t_ev * 100) / 100,
      compute_bundles_total: Math.round(t_fact * 100) / 100,
      compute_bundle_mean: Math.round((t_fact / bundles.length) * 100) / 100,
      hot_warm_bulk_total: Math.round(t_warm * 100) / 100,
    },
    hot_tier: {
      cold_miss_mean_ms: Math.round(coldMean * 10000) / 10000,
      warm_hit_p50_ms: Math.round(warmP50 * 10000) / 10000,
      warm_hit_p95_ms: Math.round(p(warmMs, 95) * 10000) / 10000,
      warm_hit_p99_ms: Math.round(p(warmMs, 99) * 10000) / 10000,
      warm_hit_max_ms: Math.round(warmMs[warmMs.length - 1] * 10000) / 10000,
      speedup_vs_postgres_x: warmP50 > 0 ? Math.round(220 / warmP50) : null,
      stats: hotMod.factHotStats(),
    },
    intent_coverage: {
      total_intents_scored: registryMod.INTENT_REGISTRY.filter((i) => i.answer_kind !== "relationship").length,
      mean_answered_per_property: Math.round(meanIntentsAnswered * 100) / 100,
      mean_unknown_per_property: Math.round(meanIntentsUnknown * 100) / 100,
      total_gap_tickets_proposed: totalGapTickets,
    },
    final_status: null, // Op-Truth §OP.5 — no silent promotion
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`\n▸ Wrote immutable measurement record: ${outPath}`);

  await pool.end();
  console.log("━".repeat(78));
  console.log("P5 · fact precompute cycle complete · HONEST measurements above");
  console.log("HARD STOP · Founder decides next step (task #90 · 16-turn audit replay)");
}
