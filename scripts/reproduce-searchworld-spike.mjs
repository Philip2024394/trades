#!/usr/bin/env node
// scripts/reproduce-searchworld-spike.mjs
//
// Founder BEGIN 2026-09-09 · SEARCHWORLD-SUB-INSTRUMENTATION
// Reproduce breakfast spike + measure accommodation baseline.
// N=15 direct-curl runs per query · report per-sub-stage percentiles.
// HARD STOP after report.

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3008";
const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 15);
const CHAT_URL = `${BASE}/api/nex-conv/chat`;

const QUERIES = [
  { label: "food_breakfast",   msg: "Any with breakfast?" },
  { label: "food_warung",      msg: "Any warung near Malioboro?" },
  { label: "accommodation_hotels", msg: "Find me hotels near Malioboro" },
];

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}
function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length,
    min: Math.round(s[0] * 100) / 100,
    p50: Math.round(pct(s, 50) * 100) / 100,
    p95: Math.round(pct(s, 95) * 100) / 100,
    p99: Math.round(pct(s, 99) * 100) / 100,
    max: Math.round(s[s.length - 1] * 100) / 100,
    mean: Math.round((sum / arr.length) * 100) / 100,
  };
}

async function ask(msg) {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg, conversation_id: null, market: "ID" }),
  });
  return res.json();
}

async function main() {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`SEARCHWORLD-SUB-INSTRUMENTATION · reproduce & measure`);
  console.log(`N=${N} per query · ${QUERIES.length} queries`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const q of QUERIES) { await ask(q.msg); await ask(q.msg); }

  const collected = {};
  const totals = {};
  const intents = {};

  for (const q of QUERIES) {
    collected[q.label] = {};
    totals[q.label] = [];
    intents[q.label] = new Set();
    for (let i = 0; i < N; i++) {
      const body = await ask(q.msg);
      const st = body?._debug_timings?.orchestrator_sub_timings ?? {};
      const orch = body?._debug_timings?.stage_ms?.orchestrator ?? null;
      const intent = body?.intent ?? "?";
      intents[q.label].add(intent);
      if (typeof orch === "number") totals[q.label].push(orch);
      for (const [k, v] of Object.entries(st)) {
        if (typeof v === "number") (collected[q.label][k] ??= []).push(v);
      }
      if (i % 5 === 0) process.stdout.write(`  ${q.label} ${i+1}/${N} orch=${orch}ms sqlAll=${st['stage_08_searchWorld__sql_promise_all']?.toFixed(0) ?? '?'}ms\n`);
    }
  }

  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  for (const q of QUERIES) {
    const tot = stats(totals[q.label]);
    console.log(``);
    console.log(`▸ ${q.label}  "${q.msg}"`);
    console.log(`  intent(s)              : ${[...intents[q.label]].join(", ")}`);
    console.log(`  orchestrator total     : n=${tot.n} P50=${tot.p50}ms P95=${tot.p95}ms P99=${tot.p99}ms max=${tot.max}ms mean=${tot.mean}ms`);
    // Just the searchWorld sub-stages (prefix stage_08_searchWorld__)
    console.log(`  searchWorld sub-stages (mean · P50 · P95 · P99 · max):`);
    const swKeys = Object.keys(collected[q.label]).filter((k) => k.startsWith("stage_08_searchWorld"));
    const swEntries = swKeys.map((k) => [k.replace("stage_08_searchWorld__", "").replace("stage_08_searchWorld", "TOTAL"), stats(collected[q.label][k])]);
    swEntries.sort((a, b) => b[1].mean - a[1].mean);
    for (const [name, s] of swEntries) {
      const pctOfTotal = tot.mean ? ((s.mean / tot.mean) * 100).toFixed(1) : "?";
      const bar = "█".repeat(Math.max(1, Math.round((s.mean / (swEntries[0][1].mean || 1)) * 25)));
      console.log(`    ${name.padEnd(30)} mean=${String(s.mean).padStart(8)}ms  P50=${String(s.p50).padStart(6)}  P95=${String(s.p95).padStart(6)}  P99=${String(s.p99).padStart(6)}  max=${String(s.max).padStart(7)}  ${pctOfTotal}%  ${bar}`);
    }
  }
  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`HARD STOP · verdict only · no optimization`);
}

main().catch((e) => { console.error(`FAILED: ${e.stack ?? e}`); process.exit(1); });
