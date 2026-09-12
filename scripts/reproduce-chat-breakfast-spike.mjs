#!/usr/bin/env node
// scripts/reproduce-chat-breakfast-spike.mjs
//
// Founder BEGIN 2026-09-09 · CHAT-ORCHESTRATOR-SUB-INSTRUMENTATION
// Reproduce the "Any with breakfast?" spike across N direct-curl runs
// and report per-sub-stage percentiles. HARD STOP after report.
//
// Also compares with:
//   - "Find me hotels near Malioboro" (accommodation, warm)
//   - "hello" (ordinary conversation)

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3008";
const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 15);
const CHAT_URL = `${BASE}/api/nex-conv/chat`;

const QUERIES = [
  { label: "breakfast_food",       msg: "Any with breakfast?" },
  { label: "hotels_malioboro",     msg: "Find me hotels near Malioboro" },
  { label: "hello_ordinary",       msg: "hello" },
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
  const sid = null;
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg, conversation_id: sid, market: "ID" }),
  });
  const body = await res.json();
  return body;
}

async function main() {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`CHAT-ORCHESTRATOR-SUB-INSTRUMENTATION · reproduce breakfast spike`);
  console.log(`endpoint: ${CHAT_URL}`);
  console.log(`N       : ${N} per query · ${QUERIES.length} queries`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Warmup 2 hits per query to stabilise
  for (const q of QUERIES) { await ask(q.msg); await ask(q.msg); }

  const collected = {}; // label → { stageName → number[] }
  const totals = {};    // label → number[]
  const intents = {};   // label → Set

  for (const q of QUERIES) {
    collected[q.label] = {};
    totals[q.label] = [];
    intents[q.label] = new Set();
    for (let i = 0; i < N; i++) {
      const body = await ask(q.msg);
      const st = body?._debug_timings?.orchestrator_sub_timings ?? {};
      const total = body?._debug_timings?.stage_ms?.total_before_response_send ?? null;
      const orch = body?._debug_timings?.stage_ms?.orchestrator ?? null;
      const intent = body?.intent ?? "?";
      intents[q.label].add(intent);
      if (typeof orch === "number") totals[q.label].push(orch);
      for (const [k, v] of Object.entries(st)) {
        if (typeof v === "number") (collected[q.label][k] ??= []).push(v);
      }
      if (i % 5 === 0) process.stdout.write(`  ${q.label} ${i + 1}/${N} orchestrator=${orch}ms intent=${intent}\n`);
    }
  }

  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  for (const q of QUERIES) {
    const tot = stats(totals[q.label]);
    console.log(``);
    console.log(`▸ ${q.label}  "${q.msg}"`);
    console.log(`  intent(s) observed          : ${[...intents[q.label]].join(", ")}`);
    console.log(`  orchestrator total          : n=${tot.n} P50=${tot.p50}ms P95=${tot.p95}ms P99=${tot.p99}ms max=${tot.max}ms mean=${tot.mean}ms`);
    console.log(`  sub-stage breakdown (mean · P50 · P95 · max):`);
    const stageEntries = Object.entries(collected[q.label]).map(([k, v]) => [k, stats(v)]);
    stageEntries.sort((a, b) => b[1].mean - a[1].mean);
    for (const [name, s] of stageEntries) {
      const pctOfTotal = tot.mean ? ((s.mean / tot.mean) * 100).toFixed(1) : "?";
      const bar = "█".repeat(Math.max(1, Math.round((s.mean / (stageEntries[0][1].mean || 1)) * 30)));
      console.log(`    ${name.padEnd(52)} mean=${String(s.mean).padStart(8)}ms  P50=${String(s.p50).padStart(6)}  P95=${String(s.p95).padStart(6)}  max=${String(s.max).padStart(7)}  ${pctOfTotal}%  ${bar}`);
    }
  }
  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`HARD STOP · verdict only · no optimization proposed`);
  console.log(`finished ${new Date().toISOString()}`);
}

main().catch((e) => { console.error(`FAILED: ${e.stack ?? e}`); process.exit(1); });
