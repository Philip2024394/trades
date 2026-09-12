#!/usr/bin/env node
// scripts/bench-accommodation-live-proof.mjs
//
// NEX Accommodation live-proof endpoint · P50 / P95 / P99 harness
// Founder BEGIN 2026-09-08 · Indonesia Complete Country Intelligence Mission
//
// Measures the /api/nex/accommodation/live-proof endpoint under warm load.
// Reports:
//   - total end-to-end latency percentiles (P50 / P95 / P99 / min / max / mean)
//   - per-stage percentiles from the endpoint's built-in latency_breakdown
//   - overhead attribution
//
// Zero fabrication. Every number is a real measurement.
// Zero LLM. Zero writes.
//
// Usage:
//   node scripts/bench-accommodation-live-proof.mjs
//   node scripts/bench-accommodation-live-proof.mjs --n 100 --url http://localhost:3008/api/nex/accommodation/live-proof
//   node scripts/bench-accommodation-live-proof.mjs --warmup 5 --n 50

import { performance } from "node:perf_hooks";

const argv = process.argv.slice(2);
function argVal(name, def) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  const v = argv[idx + 1];
  return v === undefined ? def : v;
}
const N = Number(argVal("n", 50));
const WARMUP = Number(argVal("warmup", 3));
const BASE_URL = argVal("url", "http://localhost:3008/api/nex/accommodation/live-proof?city=Yogyakarta&country=ID&limit=10");

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return { wallMs, body };
}

async function main() {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`NEX Accommodation live-proof · P50/P95/P99 bench`);
  console.log(`URL     : ${BASE_URL}`);
  console.log(`N       : ${N} (after ${WARMUP} warmup)`);
  console.log(`start   : ${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Warmup (not counted)
  for (let i = 0; i < WARMUP; i++) {
    try {
      const { wallMs } = await hit(BASE_URL);
      process.stdout.write(`warmup ${i + 1}/${WARMUP}: ${wallMs.toFixed(1)}ms\n`);
    } catch (e) {
      console.error(`warmup ${i + 1} FAILED: ${e.message}`);
      process.exit(1);
    }
  }

  // Measured runs
  const wallSamples = [];
  const serverSamples = [];
  const stageBuckets = {}; // stage → number[]
  let stageSumSamples = [];
  let overheadSamples = [];
  let foundSamples = new Set();
  let httpErrors = 0;

  for (let i = 0; i < N; i++) {
    try {
      const { wallMs, body } = await hit(BASE_URL);
      wallSamples.push(wallMs);
      if (typeof body?.latency_ms === "number") serverSamples.push(body.latency_ms);
      if (body?.latency_breakdown?.stage_sum_ms != null) stageSumSamples.push(body.latency_breakdown.stage_sum_ms);
      if (body?.latency_breakdown?.overhead_ms != null) overheadSamples.push(body.latency_breakdown.overhead_ms);
      if (typeof body?.found === "number") foundSamples.add(body.found);
      const stages = body?.latency_breakdown?.stage_ms ?? {};
      for (const [k, v] of Object.entries(stages)) {
        if (typeof v === "number") {
          (stageBuckets[k] ??= []).push(v);
        }
      }
      if (i % Math.max(1, Math.floor(N / 10)) === 0) {
        process.stdout.write(`  ${i + 1}/${N}  wall=${wallMs.toFixed(0)}ms server=${body.latency_ms}ms\n`);
      }
    } catch (e) {
      httpErrors++;
      console.error(`  ${i + 1}/${N} FAILED: ${e.message}`);
    }
  }

  const wall = stats(wallSamples);
  const server = stats(serverSamples);
  const stageSum = stats(stageSumSamples);
  const overhead = stats(overheadSamples);

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`END-TO-END LATENCY (wall clock · client-side)`);
  console.log(`  n=${wall.n}  min=${wall.min}ms  P50=${wall.p50}ms  P95=${wall.p95}ms  P99=${wall.p99}ms  max=${wall.max}ms  mean=${wall.mean}ms`);
  console.log(``);
  console.log(`SERVER-REPORTED latency_ms (excludes network round-trip)`);
  console.log(`  n=${server.n}  min=${server.min}ms  P50=${server.p50}ms  P95=${server.p95}ms  P99=${server.p99}ms  max=${server.max}ms  mean=${server.mean}ms`);
  console.log(``);
  console.log(`SUM OF INSTRUMENTED STAGES`);
  console.log(`  n=${stageSum.n}  P50=${stageSum.p50}ms  P95=${stageSum.p95}ms  P99=${stageSum.p99}ms  mean=${stageSum.mean}ms`);
  console.log(``);
  console.log(`OVERHEAD (server latency - sum of stages · Next.js + serialize + un-instrumented)`);
  console.log(`  n=${overhead.n}  P50=${overhead.p50}ms  P95=${overhead.p95}ms  P99=${overhead.p99}ms  mean=${overhead.mean}ms`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`PER-STAGE PERCENTILES (server-side instrumented)`);
  console.log(`  stage                              n     P50    P95    P99    max    mean`);
  const orderedStages = Object.entries(stageBuckets).sort((a, b) => stats(b[1]).mean - stats(a[1]).mean);
  for (const [stage, samples] of orderedStages) {
    const s = stats(samples);
    const label = stage.padEnd(34);
    console.log(`  ${label} ${String(s.n).padStart(3)}  ${String(s.p50).padStart(6)} ${String(s.p95).padStart(6)} ${String(s.p99).padStart(6)} ${String(s.max).padStart(6)} ${String(s.mean).padStart(6)}`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`INTEGRITY`);
  console.log(`  HTTP errors        : ${httpErrors}`);
  console.log(`  distinct 'found'   : ${[...foundSamples].join(", ")} (should be stable · reflects real Postgres count)`);
  console.log(`  finished           : ${new Date().toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((e) => {
  console.error(`bench FAILED: ${e.stack ?? e.message ?? e}`);
  process.exit(1);
});
