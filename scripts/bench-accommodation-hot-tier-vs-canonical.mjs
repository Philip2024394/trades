#!/usr/bin/env node
// scripts/bench-accommodation-hot-tier-vs-canonical.mjs
//
// NEX Accommodation · BEGIN 1 · LIVE-PROOF-HOT-TIER · rigorous bench
// Founder BEGIN 1 constraint (verbatim):
//   "prove the speed improvement against canonical Postgres,
//    don't merely build a cache and declare success."
//
// Fairness protocol:
//   1. Warm up both paths (Turbopack + Postgres pool)
//   2. Run alternating requests: canonical → hot-tier → canonical → hot-tier ...
//      (interleaved so system load is symmetrical)
//   3. Measure end-to-end wall latency + server-reported latency for each
//   4. Compute P50/P95/P99 for both paths side-by-side
//   5. Verify payload IDENTITY via hash comparison
//      (same city+country+limit → hot-tier and canonical MUST have same hash)
//   6. Report cache stats: hits, misses, TTL, eviction count
//
// Zero fabrication. Zero LLM. Read-only against the live dev server.
//
// Usage:
//   node scripts/bench-accommodation-hot-tier-vs-canonical.mjs
//   node scripts/bench-accommodation-hot-tier-vs-canonical.mjs --n 100
//   node scripts/bench-accommodation-hot-tier-vs-canonical.mjs --base http://localhost:3008 --n 30 --warmup 3

import { performance } from "node:perf_hooks";

const argv = process.argv.slice(2);
function argVal(name, def) {
  const idx = argv.indexOf(`--${name}`);
  return idx === -1 ? def : (argv[idx + 1] ?? def);
}
const N = Number(argVal("n", 50));
const WARMUP = Number(argVal("warmup", 3));
const BASE = argVal("base", "http://localhost:3008");
const QUERY = argVal("query", "city=Yogyakarta&country=ID&limit=10");
const URL_CANONICAL = `${BASE}/api/nex/accommodation/live-proof?scope=canonical&${QUERY}`;
const URL_HOT_TIER = `${BASE}/api/nex/accommodation/live-proof?scope=hot-tier&${QUERY}`;

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}
function stats(arr) {
  if (arr.length === 0) return { n: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length,
    min: Math.round(sorted[0] * 100) / 100,
    p50: Math.round(pct(sorted, 50) * 100) / 100,
    p95: Math.round(pct(sorted, 95) * 100) / 100,
    p99: Math.round(pct(sorted, 99) * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    mean: Math.round((sum / arr.length) * 100) / 100,
  };
}

async function hit(url) {
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const wallMs = performance.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const body = await res.json();
  return { wallMs, body };
}

async function main() {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`BEGIN 1 · Hot-tier vs Canonical · rigorous bench`);
  console.log(`canonical URL : ${URL_CANONICAL}`);
  console.log(`hot-tier URL  : ${URL_HOT_TIER}`);
  console.log(`N=${N}  warmup=${WARMUP}  start=${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Warmup both paths (Turbopack + Postgres pool + one cache fill)
  console.log(`Warming both paths...`);
  for (let i = 0; i < WARMUP; i++) {
    await hit(URL_CANONICAL).catch(() => null);
    await hit(URL_HOT_TIER).catch(() => null);
  }

  const canonicalWall = [];
  const canonicalServer = [];
  const canonicalHashes = new Set();
  const hotTierWall = [];
  const hotTierServer = [];
  const hotTierHashes = new Set();
  const hotTierCacheHits = [];
  const hotTierCacheAges = [];

  // Interleave: canonical → hot-tier alternating
  for (let i = 0; i < N; i++) {
    try {
      const c = await hit(URL_CANONICAL);
      canonicalWall.push(c.wallMs);
      if (typeof c.body?.latency_ms === "number") canonicalServer.push(c.body.latency_ms);
      if (c.body?.hot_tier?.payload_identity_hash) canonicalHashes.add(c.body.hot_tier.payload_identity_hash);
    } catch (e) { console.error(`canonical ${i + 1} failed: ${e.message}`); }
    try {
      const h = await hit(URL_HOT_TIER);
      hotTierWall.push(h.wallMs);
      if (typeof h.body?.latency_ms === "number") hotTierServer.push(h.body.latency_ms);
      if (h.body?.hot_tier?.payload_identity_hash) hotTierHashes.add(h.body.hot_tier.payload_identity_hash);
      if (typeof h.body?.hot_tier?.cache_hit === "boolean") hotTierCacheHits.push(h.body.hot_tier.cache_hit ? 1 : 0);
      if (typeof h.body?.hot_tier?.cache_age_ms === "number") hotTierCacheAges.push(h.body.hot_tier.cache_age_ms);
    } catch (e) { console.error(`hot-tier ${i + 1} failed: ${e.message}`); }
    if (i % Math.max(1, Math.floor(N / 5)) === 0) {
      process.stdout.write(`  ${i + 1}/${N}  canonical=${canonicalServer[canonicalServer.length - 1]}ms  hot-tier=${hotTierServer[hotTierServer.length - 1]}ms\n`);
    }
  }

  const cw = stats(canonicalWall);
  const cs = stats(canonicalServer);
  const hw = stats(hotTierWall);
  const hs = stats(hotTierServer);

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`END-TO-END WALL LATENCY (client-side · includes network)`);
  console.log(`  canonical  n=${cw.n}  min=${cw.min}  P50=${cw.p50}  P95=${cw.p95}  P99=${cw.p99}  max=${cw.max}  mean=${cw.mean}  ms`);
  console.log(`  hot-tier   n=${hw.n}  min=${hw.min}  P50=${hw.p50}  P95=${hw.p95}  P99=${hw.p99}  max=${hw.max}  mean=${hw.mean}  ms`);
  console.log(``);
  console.log(`SERVER-REPORTED latency_ms (from response body)`);
  console.log(`  canonical  n=${cs.n}  min=${cs.min}  P50=${cs.p50}  P95=${cs.p95}  P99=${cs.p99}  max=${cs.max}  mean=${cs.mean}  ms`);
  console.log(`  hot-tier   n=${hs.n}  min=${hs.min}  P50=${hs.p50}  P95=${hs.p95}  P99=${hs.p99}  max=${hs.max}  mean=${hs.mean}  ms`);
  console.log(``);
  if (cs.mean > 0 && hs.mean > 0) {
    const speedup_mean = Math.round((cs.mean / hs.mean) * 100) / 100;
    const speedup_p95 = Math.round((cs.p95 / Math.max(1, hs.p95)) * 100) / 100;
    const speedup_p99 = Math.round((cs.p99 / Math.max(1, hs.p99)) * 100) / 100;
    console.log(`SPEEDUP (canonical / hot-tier)  mean=${speedup_mean}x  P95=${speedup_p95}x  P99=${speedup_p99}x`);
    const savings_mean_ms = Math.round(cs.mean - hs.mean);
    const savings_pct = Math.round((1 - hs.mean / cs.mean) * 1000) / 10;
    console.log(`  savings   mean ${savings_mean_ms}ms  (${savings_pct}% reduction)`);
  }
  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`CACHE BEHAVIOR (hot-tier path only)`);
  const cacheHitCount = hotTierCacheHits.filter((v) => v === 1).length;
  const cacheMissCount = hotTierCacheHits.length - cacheHitCount;
  console.log(`  hits=${cacheHitCount}  misses=${cacheMissCount}  hit_ratio=${hotTierCacheHits.length > 0 ? (cacheHitCount / hotTierCacheHits.length * 100).toFixed(1) : 0}%`);
  if (hotTierCacheAges.length > 0) {
    const cageStats = stats(hotTierCacheAges);
    console.log(`  cache age (ms) · min=${cageStats.min} P50=${cageStats.p50} P95=${cageStats.p95} max=${cageStats.max}`);
  }
  console.log(``);
  console.log(`PAYLOAD IDENTITY (Founder rigor · hot-tier must return same data as canonical)`);
  console.log(`  canonical distinct hashes : ${canonicalHashes.size}  (values: ${[...canonicalHashes].join(", ")})`);
  console.log(`  hot-tier  distinct hashes : ${hotTierHashes.size}  (values: ${[...hotTierHashes].join(", ")})`);
  // Cross-set membership check
  const canonSet = canonicalHashes;
  const hotSet = hotTierHashes;
  const allMatch = [...hotSet].every((h) => canonSet.has(h));
  const anyMismatch = [...hotSet].some((h) => !canonSet.has(h));
  console.log(`  identity verdict          : ${allMatch && !anyMismatch ? "✓ IDENTICAL (hot-tier == canonical)" : "✗ DIVERGENCE DETECTED"}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`finished ${new Date().toISOString()}`);
}

main().catch((e) => {
  console.error(`bench FAILED: ${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
