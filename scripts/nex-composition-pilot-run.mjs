#!/usr/bin/env node
// scripts/nex-composition-pilot-run.mjs
//
// NEX Master AI Engineer · Intelligence Composition Pilot · MEASUREMENT RUNNER
// Founder BEGIN 2026-09-08 + mid-mission latency directive + hot-tier discipline
//
// Runs the Accommodation test corpus through the ResponseComposer and
// produces the exact table Founder specified:
//
//   1,000 test questions
//   A Deterministic              XX%
//   B Knowledge + deterministic  XX%
//   C Retrieval + reasoning      XX%
//   D Local LLM                   XX%
//   E Unknown                     XX%
//   Postgres avoided             XX%
//   Hot-tier hit                 XX%
//   P50 / P95 / P99              XX ms
//
// Zero network dependencies beyond Postgres (for hot tier load) and
// optionally Ollama (only Route D questions).
//
// Immutable output at data/pilot-nex-composition/results/pilot_run_{iso}.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_PILOT_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local")) ? ["--env-file=.env.local"] : [];
  const child = spawn("npx", ["tsx", ...envFileArgs, entryFile, ...process.argv.slice(2)], {
    stdio: "inherit", cwd: repoRoot, shell: true,
    env: { ...process.env, NEX_PILOT_INNER: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const startedAtIso = new Date().toISOString();
  const startedAtEpoch = Date.now();

  const {
    ResponseComposer,
    DEFAULT_COMPOSER_CONFIG,
  } = await import("../src/lib/nex/response-composer/composer.ts");
  const { ResponseComposerCache } = await import("../src/lib/nex/response-composer/semantic-cache.ts");
  const { HotAccommodationTier } = await import("../src/lib/nex/response-composer/hot-accommodation-tier.ts");
  const { buildHotTierPostgresLoader } = await import("../src/lib/nex/response-composer/hot-tier-postgres-loader.ts");
  const { performance } = await import("node:perf_hooks");

  const authId = "V5.4.6-AUTH-COMPOSITION-PILOT-RUN-001";

  console.log("═".repeat(72));
  console.log("NEX INTELLIGENCE COMPOSITION PILOT · MEASUREMENT RUNNER");
  console.log("═".repeat(72));
  console.log(`Scoring auth ID    : ${authId}`);
  console.log(`Started (ISO)      : ${startedAtIso}`);
  console.log(`Repo root          : ${repoRoot}`);
  console.log(`NEX_OBJECT_BACKEND : ${process.env.NEX_OBJECT_BACKEND}`);
  console.log(`NEX_POSTGRES_URL   : ${process.env.NEX_POSTGRES_URL ? "SET" : "UNSET"}`);
  console.log("═".repeat(72));

  // ─────────────────────────────────────────────────────────
  // Load corpus
  // ─────────────────────────────────────────────────────────
  const corpusFileArg = process.argv.find((a) => a.startsWith("--corpus="))?.slice("--corpus=".length);
  const corpusPath = corpusFileArg
    ? path.resolve(repoRoot, corpusFileArg)
    : path.join(repoRoot, "data", "pilot-nex-composition", "corpus-accommodation-v1.jsonl");
  if (!fs.existsSync(corpusPath)) {
    console.error(`Missing corpus: ${corpusPath}`);
    process.exit(2);
  }
  const cases = fs.readFileSync(corpusPath, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  console.log(`\nCorpus              : ${cases.length} cases`);

  // ─────────────────────────────────────────────────────────
  // Boot hot tier from Postgres (single scan · then all in RAM)
  // ─────────────────────────────────────────────────────────
  console.log("\n─── Booting hot-tier from canonical Postgres ────────────────────────");
  let hotTier = null;
  let pool = null;
  let canonicalFallback = null;
  if (process.env.NEX_POSTGRES_URL) {
    try {
      const pgLib = await import("pg");
      const { Pool } = pgLib.default ?? pgLib;
      pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2, connectionTimeoutMillis: 10000 });
      const loader = buildHotTierPostgresLoader(pool, { onlyVisible: true });
      hotTier = new HotAccommodationTier({ ttlSeconds: 15 * 60 });
      const t0 = performance.now();
      const snap = await hotTier.load(loader);
      const bootMs = Math.round((performance.now() - t0) * 100) / 100;
      console.log(`  snapshot_id        : ${snap.snapshot_id}`);
      console.log(`  records            : ${snap.record_count}`);
      console.log(`  distinct_cities    : ${snap.distinct_cities}`);
      console.log(`  with_coords        : ${snap.with_coords}`);
      console.log(`  source_query_ms    : ${snap.source_query_ms}`);
      console.log(`  build_ms           : ${snap.build_ms}`);
      console.log(`  memory_bytes_approx: ${snap.memory_bytes_approx}`);
      console.log(`  total boot_ms      : ${bootMs}`);

      // Canonical fallback for cold-tier misses
      canonicalFallback = {
        lookupByRef: async (ref) => {
          const res = await pool.query(
            `SELECT * FROM nex.accommodation_business WHERE public_listing_ref=$1 LIMIT 1`, [ref]);
          if (res.rows.length === 0) return null;
          const r = res.rows[0];
          return {
            public_listing_ref: String(r.public_listing_ref),
            business_name: String(r.business_name),
            city: r.city, district: r.district, address: r.address,
            coordinates_lat: r.coordinates_lat != null ? Number(r.coordinates_lat) : null,
            coordinates_lng: r.coordinates_lng != null ? Number(r.coordinates_lng) : null,
            categories: [], amenities: [], star_rating: r.star_rating, room_count: r.room_count,
            rating: r.rating, review_count: r.review_count, claim_status: r.claim_status,
            updated_at_iso: r.updated_at ? new Date(r.updated_at).toISOString() : new Date(0).toISOString(),
            _name_lower: r.business_name.toLowerCase(), _city_lower: r.city ? r.city.toLowerCase() : null,
          };
        },
        lookupByCity: async () => [],
      };
    } catch (e) {
      console.log(`  hot-tier boot FAILED: ${e.message}`);
      console.log(`  proceeding WITHOUT hot-tier · Route B/C will fall through to E`);
    }
  } else {
    console.log("  NEX_POSTGRES_URL unset · skipping hot-tier boot");
  }

  // ─────────────────────────────────────────────────────────
  // Boot Ollama provider (only used for Route D)
  // ─────────────────────────────────────────────────────────
  console.log("\n─── Checking Ollama availability for Route D ────────────────────────");
  const ollamaUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
  const ollamaModel = process.env.NEX_PILOT_LOCAL_MODEL ?? "qwen2.5:3b"; // pilot uses smaller model for speed
  let ollamaReady = false;
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const j = await res.json();
      const available = (j.models ?? []).map((m) => m.name);
      ollamaReady = available.includes(ollamaModel);
      console.log(`  ollama available   : YES · ${available.length} models`);
      console.log(`  target model       : ${ollamaModel} (${ollamaReady ? "AVAILABLE" : "MISSING"})`);
    }
  } catch (e) {
    console.log(`  ollama not reachable: ${e.message}`);
  }

  const localInference = ollamaReady ? async (opts) => {
    const t0 = performance.now();
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: opts.prompt,
        system: opts.system,
        stream: false,
        options: { num_predict: opts.maxTokens ?? 256 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
    });
    const totalMs = performance.now() - t0;
    if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
    const j = await res.json();
    return {
      text: j.response ?? "",
      input_tokens: j.prompt_eval_count ?? 0,
      output_tokens: j.eval_count ?? 0,
      ttft_ms: Math.round((j.prompt_eval_duration ?? 0) / 1e6),
      total_ms: Math.round(totalMs * 100) / 100,
      stop_reason: j.done_reason ?? "stop",
      provider_name: "ollama",
      model_name: ollamaModel,
    };
  } : null;

  // ─────────────────────────────────────────────────────────
  // Build cache + composer
  // ─────────────────────────────────────────────────────────
  const cachePath = path.join(repoRoot, "data", "pilot-nex-composition", "cache-log.jsonl");
  if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); // fresh cache for pilot
  const cache = new ResponseComposerCache({
    persistJsonlPath: cachePath,
    semanticThreshold: 0.85,
    defaultTtlSeconds: 6 * 3600,
  });

  const composer = new ResponseComposer(
    { cache, hotTier, canonicalFallback, localInference },
    { ...DEFAULT_COMPOSER_CONFIG, refuse_llm_when_route_below_D: true },
  );

  // ─────────────────────────────────────────────────────────
  // Run corpus · single pass + cache-warmed second pass
  // ─────────────────────────────────────────────────────────
  console.log("\n─── PASS 1 · cold cache ────────────────────────────────────────────");
  const cold = await runPass(cases, composer, "cold");
  console.log("─── PASS 2 · warm cache ────────────────────────────────────────────");
  const warm = await runPass(cases, composer, "warm");

  // ─────────────────────────────────────────────────────────
  // Aggregate + print Founder-target matrix
  // ─────────────────────────────────────────────────────────
  console.log("\n═".repeat(72));
  console.log("RESULTS · PASS 1 (cold cache)");
  console.log("═".repeat(72));
  printAggregate(cold);
  console.log("");
  console.log("═".repeat(72));
  console.log("RESULTS · PASS 2 (warm cache · exact + semantic hits enabled)");
  console.log("═".repeat(72));
  printAggregate(warm);

  // ─────────────────────────────────────────────────────────
  // Persist immutable result record (Op-Truth §OP.5)
  // ─────────────────────────────────────────────────────────
  const outDir = path.join(repoRoot, "data", "pilot-nex-composition", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const stampSafe = startedAtIso.replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `pilot_run_${stampSafe}.json`);
  const totalDurationMs = Date.now() - startedAtEpoch;
  const record = {
    label: authId,
    schema_version: "v1.0",
    started_at_iso: startedAtIso,
    completed_at_iso: new Date().toISOString(),
    duration_ms: totalDurationMs,
    corpus_case_count: cases.length,
    hot_tier_snapshot: hotTier?.getSnapshot() ?? null,
    ollama_model_used: ollamaReady ? ollamaModel : null,
    pass_1_cold: cold,
    pass_2_warm: warm,
    hypothesis_verdict: hypothesisVerdict(cold, warm),
    founder_target_matrix: {
      cold: buildFounderMatrix(cold),
      warm: buildFounderMatrix(warm),
    },
    final_status: null, // Op-Truth §OP.5 · Founder verifier
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), "utf8");
  console.log("");
  console.log("═".repeat(72));
  console.log("MEASUREMENT COMPLETE");
  console.log("═".repeat(72));
  console.log(`Immutable record   : ${path.relative(repoRoot, outPath)}`);
  console.log(`Duration           : ${totalDurationMs} ms`);
  console.log(`Hypothesis verdict : ${record.hypothesis_verdict.summary}`);

  if (pool) await pool.end();
  process.exit(0);
}

async function runPass(cases, composer, label) {
  const results = [];
  for (const c of cases) {
    const res = await composer.answer({
      question: c.question,
      user_scope: "pilot_scope",
      surface: "api",
      pilot_context: { corpus_id: "accommodation-v1", case_id: c.case_id, expected_route_class: c.expected_route },
    });
    results.push({
      case_id: c.case_id,
      type: c.type,
      question: c.question,
      expected_route: c.expected_route,
      actual_route: res.route_class,
      match: c.expected_route === res.route_class,
      latency_ms: res.trace.latency_ms,
      cache_exact: res.trace.cache.exact_lookup,
      cache_semantic: res.trace.cache.semantic_lookup,
      cache_stale: res.trace.cache.stale_rejected,
      postgres_avoided: (res.trace).pilot?.postgres_avoided,
      hot_tier_hit: (res.trace).pilot?.hot_tier_hit,
      inference_used: !!res.trace.inference,
      inference_total_ms: res.trace.inference?.total_ms ?? null,
      answer_kind: res.trace.response.answer_kind,
      confidence: res.trace.response.confidence,
      reason_code: res.trace.route.reason_code,
      knowledge_count: res.trace.knowledge.length,
      tools_count: res.trace.tools.length,
      failure: res.trace.failure_mode?.code ?? null,
    });
  }
  return { pass: label, results };
}

function printAggregate({ pass, results }) {
  const total = results.length;
  const routeCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const latencies = [];
  let matches = 0;
  let postgresAvoided = 0;
  let hotTierHit = 0;
  let cacheHit = 0;
  let semanticHit = 0;
  let inferenceUsed = 0;
  let staleRejected = 0;
  let failures = 0;
  for (const r of results) {
    routeCounts[r.actual_route] = (routeCounts[r.actual_route] ?? 0) + 1;
    latencies.push(r.latency_ms);
    if (r.match) matches++;
    if (r.postgres_avoided) postgresAvoided++;
    if (r.hot_tier_hit) hotTierHit++;
    if (r.cache_exact === "hit") cacheHit++;
    if (r.cache_semantic === "hit") semanticHit++;
    if (r.inference_used) inferenceUsed++;
    if (r.cache_stale) staleRejected++;
    if (r.failure) failures++;
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (frac) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * frac))] ?? 0;
  console.log(`Pass                     : ${pass} · ${total} cases`);
  console.log(`Expected route matched   : ${matches}/${total} (${((matches/total)*100).toFixed(1)}%)`);
  console.log(`Failures                 : ${failures}`);
  console.log("");
  console.log("ROUTE DISTRIBUTION");
  for (const r of ["A","B","C","D","E"]) {
    const c = routeCounts[r] ?? 0;
    const pct = ((c/total)*100).toFixed(1).padStart(5);
    console.log(`  ${r}  ${pct}%  (${c}/${total})  · ${routeDescription(r)}`);
  }
  console.log("");
  console.log("EFFICIENCY");
  console.log(`  Postgres avoided       : ${((postgresAvoided/total)*100).toFixed(1)}% (${postgresAvoided}/${total})`);
  console.log(`  Hot-tier hit           : ${((hotTierHit/total)*100).toFixed(1)}% (${hotTierHit}/${total})`);
  console.log(`  Cache exact hit        : ${((cacheHit/total)*100).toFixed(1)}% (${cacheHit}/${total})`);
  console.log(`  Cache semantic hit     : ${((semanticHit/total)*100).toFixed(1)}% (${semanticHit}/${total})`);
  console.log(`  Cache stale rejected   : ${staleRejected}`);
  console.log(`  Inference invoked      : ${((inferenceUsed/total)*100).toFixed(1)}% (${inferenceUsed}/${total})`);
  console.log("");
  console.log("LATENCY (ms)");
  console.log(`  P50   ${p(0.50).toString().padStart(8)}`);
  console.log(`  P95   ${p(0.95).toString().padStart(8)}`);
  console.log(`  P99   ${p(0.99).toString().padStart(8)}`);
  console.log(`  MAX   ${sorted[sorted.length-1]?.toString().padStart(8) ?? "0"}`);
}

function buildFounderMatrix({ results }) {
  const total = results.length;
  const rc = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const lat = [];
  let pgAvoid = 0, htHit = 0;
  for (const r of results) {
    rc[r.actual_route] = (rc[r.actual_route] ?? 0) + 1;
    lat.push(r.latency_ms);
    if (r.postgres_avoided) pgAvoid++;
    if (r.hot_tier_hit) htHit++;
  }
  lat.sort((a, b) => a - b);
  const p = (f) => lat[Math.min(lat.length - 1, Math.floor(lat.length * f))] ?? 0;
  return {
    total,
    A_deterministic: rc.A, A_pct: pct(rc.A, total),
    B_knowledge_plus_deterministic: rc.B, B_pct: pct(rc.B, total),
    C_retrieval_plus_reasoning: rc.C, C_pct: pct(rc.C, total),
    D_local_llm: rc.D, D_pct: pct(rc.D, total),
    E_unknown: rc.E, E_pct: pct(rc.E, total),
    postgres_avoided_pct: pct(pgAvoid, total),
    hot_tier_hit_pct: pct(htHit, total),
    P50_ms: p(0.5), P95_ms: p(0.95), P99_ms: p(0.99),
  };
}
function pct(n, d) { return d === 0 ? 0 : Math.round((n/d) * 1000) / 10; }
function routeDescription(r) {
  return ({
    A: "deterministic only",
    B: "knowledge + deterministic",
    C: "retrieval + reasoning",
    D: "local LLM",
    E: "unknown · Gap enqueue",
  })[r] ?? "?";
}
function hypothesisVerdict(cold, warm) {
  const warmMatrix = buildFounderMatrix(warm);
  const llmFraction = warmMatrix.D_pct;
  const supported = llmFraction < 20;
  return {
    supported,
    summary: supported
      ? `SUPPORTED · LLM invoked on only ${llmFraction}% of routine cases · ${100-llmFraction}% answered without inference`
      : `NOT SUPPORTED · LLM invoked on ${llmFraction}% · needs more deterministic routes OR corpus is not routine`,
    llm_fraction_pct: llmFraction,
    postgres_avoided_pct: warmMatrix.postgres_avoided_pct,
    hot_tier_hit_pct: warmMatrix.hot_tier_hit_pct,
  };
}
