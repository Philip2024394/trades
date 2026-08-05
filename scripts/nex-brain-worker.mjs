#!/usr/bin/env node
// NEX Brain 24/7 worker — Philip 2026-08-06 · Stage 2
//
// Run in a separate terminal alongside `npm run dev` (or as a
// systemd/pm2/nodemon service in production). Polls the
// /api/nex/brain/run-once endpoint every INTERVAL_MS milliseconds.
//
// This is the zero-deploy option — works today on Philip's laptop
// without needing a public URL, cron service, or hosting account.
// The always-on machine can be the same laptop, a Raspberry Pi, a
// $5 VPS, or a Fly.io free machine.
//
// Once the app is deployed publicly, this script is superseded by
// Vercel Cron (see vercel.json) or an external cron (see
// docs/BRAIN_CRON_SETUP.md). All three options hit the same endpoint.
//
// Env vars:
//   NEX_BRAIN_URL        — base URL (default http://localhost:3008)
//   NEX_BRAIN_CRON_TOKEN — optional shared secret; if the server has
//                          this set, this script must send it too
//   NEX_BRAIN_INTERVAL   — polling interval in ms (default 30000)
//   NEX_BRAIN_BATCH      — items to process per cycle (default 5)
//
// Usage:
//   node scripts/nex-brain-worker.mjs
//
// Stop with Ctrl+C. Graceful shutdown drains in-flight requests.

const BASE_URL = process.env.NEX_BRAIN_URL || "http://localhost:3008";
const CRON_TOKEN = process.env.NEX_BRAIN_CRON_TOKEN || "";
const INTERVAL_MS = Number(process.env.NEX_BRAIN_INTERVAL) || 30_000;
const BATCH = Number(process.env.NEX_BRAIN_BATCH) || 5;
const START = Date.now();

let running = true;
let cyclesRun = 0;
let cyclesFailed = 0;
let lastReportAt = 0;

const REPORT_INTERVAL_MS = 5 * 60 * 1000; // brief summary every 5 min

process.on("SIGINT", () => {
  console.log("\n[nex-brain-worker] Ctrl+C — draining and stopping…");
  running = false;
});
process.on("SIGTERM", () => {
  console.log("[nex-brain-worker] SIGTERM — stopping…");
  running = false;
});

console.log(`[nex-brain-worker] starting`);
console.log(`  target : ${BASE_URL}`);
console.log(`  every  : ${INTERVAL_MS}ms`);
console.log(`  batch  : ${BATCH} items per cycle per worker`);
console.log(`  token  : ${CRON_TOKEN ? "configured" : "(none)"}`);
console.log("");

async function runOne() {
  const headers = { "content-type": "application/json" };
  if (CRON_TOKEN) headers["x-brain-cron-token"] = CRON_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${BASE_URL}/api/nex/brain/run-once`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        context_batch: BATCH,
        voice_batch: BATCH,
        learning_batch: BATCH,
        extractor_batch: BATCH,
        checker_batch: BATCH * 2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const j = await res.json();
    if (!j.ok) {
      throw new Error(`server not ok: ${JSON.stringify(j).slice(0, 200)}`);
    }
    cyclesRun += 1;
    return j.cycle;
  } catch (err) {
    cyclesFailed += 1;
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function maybeReport(cycle) {
  const now = Date.now();
  if (now - lastReportAt < REPORT_INTERVAL_MS) return;
  lastReportAt = now;
  const uptimeMin = Math.round((now - START) / 60_000);
  console.log(
    `[nex-brain-worker] ${new Date().toISOString()} · uptime ${uptimeMin}m ` +
      `· cycles ok ${cyclesRun} · failed ${cyclesFailed}`
  );
  if (cycle) {
    console.log(
      `  last cycle: ${cycle.extracted_record_ids?.length ?? 0} drafted, ` +
        `${cycle.checked_records?.length ?? 0} checked in ${cycle.duration_ms}ms`
    );
  }
}

async function loop() {
  while (running) {
    const start = Date.now();
    let cycle = null;
    try {
      cycle = await runOne();
      // Only log real activity (drafts / checks); otherwise stay quiet.
      const hasActivity =
        (cycle?.extracted_record_ids?.length ?? 0) > 0 ||
        (cycle?.checked_records?.length ?? 0) > 0 ||
        (cycle?.contexts_assembled?.length ?? 0) > 0;
      if (hasActivity) {
        console.log(
          `[nex-brain-worker] ${new Date().toISOString()} · ` +
            `ctx ${cycle.contexts_assembled?.length ?? 0} · ` +
            `voice ${cycle.voice_guides?.length ?? 0} · ` +
            `learn ${cycle.learning_bundles?.length ?? 0} · ` +
            `draft ${cycle.extracted_record_ids?.length ?? 0} · ` +
            `check ${cycle.checked_records?.length ?? 0} · ` +
            `${cycle.duration_ms}ms`
        );
      }
    } catch (err) {
      console.error(`[nex-brain-worker] cycle failed: ${err.message}`);
    }
    maybeReport(cycle);

    const elapsed = Date.now() - start;
    const wait = Math.max(0, INTERVAL_MS - elapsed);
    // Sleep in small chunks so Ctrl+C is responsive
    for (let waited = 0; waited < wait && running; waited += 500) {
      await new Promise((r) => setTimeout(r, Math.min(500, wait - waited)));
    }
  }
  console.log(`[nex-brain-worker] stopped · ${cyclesRun} cycles ok · ${cyclesFailed} failed`);
  process.exit(0);
}

loop();
