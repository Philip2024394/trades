#!/usr/bin/env node
// scripts/nex-chat-endurance-test.mjs
//
// Founder 2026-09-10 · Chat endurance test.
//
// Fires N messages against /api/nex-conv/chat across a time window and
// reports how many succeeded, how many errored, latency stats. This is
// the acceptance test for "user can have 1-hour conversation without
// nex chat error replies".
//
// Usage:
//   node scripts/nex-chat-endurance-test.mjs                  # default: 60s
//   node scripts/nex-chat-endurance-test.mjs --duration 120   # 2 min
//   node scripts/nex-chat-endurance-test.mjs --duration 3600  # 1 hour
//   node scripts/nex-chat-endurance-test.mjs --concurrency 3  # parallel streams
//
// Success criteria (pass = exit 0):
//   · 0 HTTP 500s
//   · 0 HTTP 504s
//   · Every reply has a valid envelope shape
//   · p99 latency < 30s (LLM cold start OK)

import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}

const DURATION_SEC   = Number(args.get("duration") ?? "60");
const CONCURRENCY    = Number(args.get("concurrency") ?? "1");
const BASE_URL       = args.get("url") ?? "http://localhost:3008";
const CHAT_ENDPOINT  = `${BASE_URL}/api/nex-conv/chat`;
const CONVERSATION   = args.get("conversation") ?? cryptoUuid();

const CONVERSATION_SCRIPT = [
  "hi",
  "what can you help me with",
  "i need a hotel",
  "in yogyakarta",
  "how about with a pool",
  "show me the first one",
  "what's the phone number",
  "any nearby restaurants",
  "what about halal food",
  "actually let me see hostels instead",
  "in bali this time",
  "cheapest one",
  "does it have wifi",
  "how far from the airport",
  "any reviews",
  "what about family-friendly options",
  "with parking",
  "for 4 people",
  "next weekend",
  "thanks",
];

function cryptoUuid() {
  return randomUUID();
}

const results = {
  started_iso: new Date().toISOString(),
  duration_target_sec: DURATION_SEC,
  concurrency: CONCURRENCY,
  base_url: BASE_URL,
  conversation_id: CONVERSATION,
  sent: 0,
  ok_200: 0,
  http_500: 0,
  http_504: 0,
  http_other: 0,
  network_err: 0,
  envelope_invalid: 0,
  envelope_error_replies: 0,
  latencies_ms: [],
  error_samples: [],
};

function recordLatency(ms) {
  results.latencies_ms.push(ms);
}

async function fireOne(msg, streamId) {
  const startMs = Date.now();
  results.sent++;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        conversation_id: `${CONVERSATION}-stream${streamId}`,
        market: "ID",
        useLiveWorld: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - startMs;
    recordLatency(latency);

    if (res.status === 500) {
      results.http_500++;
      if (results.error_samples.length < 5) {
        const body = await res.text().catch(() => "<no body>");
        results.error_samples.push({ status: 500, msg, body: body.slice(0, 300) });
      }
      return;
    }
    if (res.status === 504) {
      results.http_504++;
      return;
    }
    if (res.status !== 200) {
      results.http_other++;
      if (results.error_samples.length < 5) {
        results.error_samples.push({ status: res.status, msg, body: "" });
      }
      return;
    }

    results.ok_200++;
    // Validate envelope shape
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== "object" || body.reply === undefined) {
      results.envelope_invalid++;
      if (results.error_samples.length < 5) {
        results.error_samples.push({ status: 200, msg, body: "envelope missing reply field" });
      }
      return;
    }
    // Check if the reply itself is the graceful-error message from our wrapper
    if (body.composition_meta?.reason?.startsWith("handler_exception:")) {
      results.envelope_error_replies++;
      if (results.error_samples.length < 5) {
        results.error_samples.push({
          status: 200, msg,
          body: `graceful_error: ${body.composition_meta.reason.slice(0, 200)}`,
        });
      }
    }
  } catch (err) {
    const latency = Date.now() - startMs;
    recordLatency(latency);
    results.network_err++;
    if (results.error_samples.length < 5) {
      results.error_samples.push({
        status: "network",
        msg,
        body: err instanceof Error ? err.message.slice(0, 300) : String(err),
      });
    }
  }
}

async function runStream(streamId, deadlineMs) {
  let idx = 0;
  while (Date.now() < deadlineMs) {
    const msg = CONVERSATION_SCRIPT[idx % CONVERSATION_SCRIPT.length];
    idx++;
    await fireOne(msg, streamId);
    // 1-3s gap between messages to simulate human pacing
    await sleep(1000 + Math.floor(Math.random() * 2000));
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`[endurance] starting · duration=${DURATION_SEC}s concurrency=${CONCURRENCY} url=${CHAT_ENDPOINT}`);
  console.log(`[endurance] conversation base id: ${CONVERSATION}`);
  const deadlineMs = Date.now() + DURATION_SEC * 1000;

  const streams = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    streams.push(runStream(i, deadlineMs));
  }
  await Promise.all(streams);

  const finishedMs = Date.now();
  const elapsed = ((finishedMs - Date.parse(results.started_iso)) / 1000).toFixed(1);
  const sortedLat = [...results.latencies_ms].sort((a, b) => a - b);
  const p50 = percentile(sortedLat, 50);
  const p95 = percentile(sortedLat, 95);
  const p99 = percentile(sortedLat, 99);
  const max = sortedLat[sortedLat.length - 1] ?? 0;

  const totalErrors = results.http_500 + results.http_504 + results.http_other + results.network_err + results.envelope_invalid + results.envelope_error_replies;
  const pass = totalErrors === 0 && p99 < 30_000;

  const report = {
    ...results,
    finished_iso: new Date(finishedMs).toISOString(),
    elapsed_sec: Number(elapsed),
    latency_p50_ms: p50,
    latency_p95_ms: p95,
    latency_p99_ms: p99,
    latency_max_ms: max,
    total_errors: totalErrors,
    pass,
  };
  delete report.latencies_ms; // don't dump raw array

  console.log("");
  console.log("┌─ NEX CHAT ENDURANCE TEST · REPORT ────────────────────");
  console.log(`│ duration          : ${report.elapsed_sec}s / ${DURATION_SEC}s target`);
  console.log(`│ concurrency       : ${CONCURRENCY}`);
  console.log(`│ messages sent     : ${report.sent}`);
  console.log(`│ ok 200            : ${report.ok_200}`);
  console.log(`│ http 500          : ${report.http_500}`);
  console.log(`│ http 504          : ${report.http_504}`);
  console.log(`│ http other        : ${report.http_other}`);
  console.log(`│ network errors    : ${report.network_err}`);
  console.log(`│ envelope invalid  : ${report.envelope_invalid}`);
  console.log(`│ graceful errors   : ${report.envelope_error_replies}`);
  console.log(`│ latency p50/p95/p99/max : ${p50}/${p95}/${p99}/${max} ms`);
  console.log(`│ VERDICT           : ${pass ? "PASS ✓" : "FAIL ✗"}`);
  if (report.error_samples.length > 0) {
    console.log("│ error samples:");
    for (const s of report.error_samples) {
      console.log(`│   status=${s.status} msg="${s.msg}" body="${s.body}"`);
    }
  }
  console.log("└───────────────────────────────────────────────────────");

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("[endurance] fatal:", err);
  process.exit(2);
});
