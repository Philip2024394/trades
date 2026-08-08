#!/usr/bin/env node
// NEX Brain Cloud Worker — Philip 2026-08-06 · Phase 5
//
// The always-on cloud runtime. Runs on Fly.io (or any container host)
// and processes the NEX Brain worker queue directly against Supabase.
// Does NOT depend on the Next.js server being reachable — it imports
// the manager and calls runOneCycle() in-process.
//
// Responsibilities:
//   · pull jobs from Supabase (via SupabaseStore + SKIP LOCKED RPC)
//   · run the 5-stage pipeline every INTERVAL_MS
//   · drain the LLM retry queue
//   · write a heartbeat every HEARTBEAT_MS so the dashboard tile
//     can show "Cloud worker: online · last beat 12s ago"
//   · expose /health on PORT so Fly's built-in check can restart us
//   · shut down cleanly on SIGTERM (Fly sends this on redeploy)
//
// What it does NOT do (deliberately):
//   · dispatch new inbox items — that reads from local filesystem
//     and stays on Philip's Next.js machine
//   · image analysis by default — image jobs reference local file
//     paths (data/knowledge-inbox/uploads/*) that don't exist in
//     the container. Set RUN_IMAGE_ANALYST=1 once images move to
//     Supabase Storage.
//
// Env vars:
//   NEX_SUPABASE_URL              — required
//   NEX_SUPABASE_SERVICE_ROLE_KEY — required
//   NEX_BRAIN_BACKEND=supabase    — required (fs backend cannot run in cloud)
//   GROQ_API_KEY                  — required (primary LLM provider)
//   GOOGLE_GEMINI_API_KEY         — optional (vision + fallback)
//   ANTHROPIC_API_KEY             — optional (fallback)
//   PORT                          — health server port (default 8080)
//   NEX_WORKER_INTERVAL_MS        — cycle interval (default 5000)
//   NEX_WORKER_HEARTBEAT_MS       — heartbeat interval (default 10000)
//   NEX_WORKER_CONTEXT_BATCH      — jobs per stage (default 3)
//   NEX_WORKER_CHECKER_BATCH      — checker batch (default 6)
//   NEX_WORKER_RETRY_BATCH        — LLM retries per cycle (default 3)
//   FLY_MACHINE_ID / HOSTNAME     — host_id for heartbeats
//   RUN_IMAGE_ANALYST=1           — opt in to image jobs (see above)

import { createServer } from "node:http";
import { runOneCycle, type CycleReport } from "@/lib/nex/brain/manager";
import { brainStore } from "@/lib/nex/brain/storage";

const INTERVAL_MS = Number(process.env.NEX_WORKER_INTERVAL_MS ?? 5000);
const HEARTBEAT_MS = Number(process.env.NEX_WORKER_HEARTBEAT_MS ?? 10_000);
const CONTEXT_BATCH = Number(process.env.NEX_WORKER_CONTEXT_BATCH ?? 3);
const CHECKER_BATCH = Number(process.env.NEX_WORKER_CHECKER_BATCH ?? 6);
const RETRY_BATCH = Number(process.env.NEX_WORKER_RETRY_BATCH ?? 3);
const PORT = Number(process.env.PORT ?? 8080);
const HOST_ID =
  process.env.FLY_MACHINE_ID ??
  process.env.HOSTNAME ??
  `local-${process.pid}`;
const REGION = process.env.FLY_REGION ?? "local";

const START = Date.now();
let running = true;
let cyclesTotal = 0;
let cyclesFailed = 0;
let lastCycle: CycleReport | null = null;
let lastCycleAt = 0;
let lastHeartbeatAt = 0;
let lastError: string | null = null;

// ── Startup validation ───────────────────────────────────────────────
//
// Wave 4 · single-queue safeguard (Philip 2026-08-09 · Headquarters
// Production Readiness Programme). The legacy Fly deployment at
// nex-brain-worker (Aug 6 image, pre-Phase-12.3 heartbeats, hardcoded
// NEX_BRAIN_BACKEND=supabase) was destroyed via `fly scale count 0`
// during Wave 1 because it competed with the local dev worker for the
// same queue and image-analyst jobs (which need location-transparent
// file access via NEX Object Storage · Wave 3).
//
// If this container ever restarts unmodified, it would reintroduce
// the split-brain. This guard REFUSES to start unless the operator
// has explicitly signaled they have (a) redeployed against the new
// Headquarters architecture and (b) verified the cloud worker is
// using NEX Postgres + NEX Object Storage.
//
// To resume · consciously · after the Wave 5 flip:
//   1. Rebuild the Fly image from the CURRENT code (not the Aug 6 image)
//   2. Set NEX_BRAIN_BACKEND=postgres + NEX_POSTGRES_URL on Fly
//   3. Set NEX_OBJECT_BACKEND=postgres on Fly
//   4. Set NEX_WORKER_CONSENT_V2=YES on Fly
//   5. Deploy
// Without step 4, this guard fires and the container refuses to boot.
if (process.env.NEX_WORKER_CONSENT_V2 !== "YES") {
  console.error(
    JSON.stringify({
      level: "fatal",
      msg:
        "cloud-worker refuses to start · Wave 4 safeguard active · " +
        "the legacy Fly deployment was decommissioned 2026-08-09 during " +
        "Headquarters Production Readiness · to consciously resume set " +
        "NEX_WORKER_CONSENT_V2=YES on the Fly app and ensure NEX_BRAIN_BACKEND=postgres " +
        "+ NEX_OBJECT_BACKEND=postgres · see docs/headquarters-production-readiness/HEADQUARTERS-WORKER-DEPLOYMENT-AUDIT.md",
    })
  );
  process.exit(1);
}

// After the consent gate: allow supabase (transitional · legacy image
// path) OR postgres (target · Headquarters v2). Filesystem still fatal
// because the cloud worker cannot see per-machine data.
const BACKEND = process.env.NEX_BRAIN_BACKEND ?? "";
if (BACKEND !== "supabase" && BACKEND !== "postgres") {
  console.error(
    JSON.stringify({
      level: "fatal",
      msg: `cloud-worker requires NEX_BRAIN_BACKEND=supabase (legacy) or postgres (v2); got "${BACKEND}"; refusing to start`,
    })
  );
  process.exit(1);
}

const hasUrl =
  process.env.NEX_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
  process.env.SUPABASE_URL;
const hasKey =
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!hasUrl || !hasKey) {
  console.error(
    JSON.stringify({
      level: "fatal",
      msg: "missing Supabase URL or service_role key — set NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY",
    })
  );
  process.exit(1);
}

// ── Structured logging (JSON lines — Fly log parsers love these) ────

function log(
  level: "info" | "warn" | "error",
  msg: string,
  extra: Record<string, unknown> = {}
): void {
  const payload = {
    level,
    msg,
    host: HOST_ID,
    region: REGION,
    ts: new Date().toISOString(),
    ...extra,
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

// ── Signal handlers — clean shutdown on Fly redeploy ────────────────

process.on("SIGTERM", () => {
  log("info", "signal", { signal: "SIGTERM", action: "draining" });
  running = false;
});
process.on("SIGINT", () => {
  log("info", "signal", { signal: "SIGINT", action: "draining" });
  running = false;
});

// ── Health server for Fly's built-in check ──────────────────────────

const healthServer = createServer((req, res) => {
  if (req.url === "/health") {
    // Healthy if: still running AND last heartbeat within 2 min
    // (during first 2 min after boot, always healthy — grace period).
    const uptime = Date.now() - START;
    const heartbeatFresh =
      uptime < 120_000 || Date.now() - lastHeartbeatAt < 120_000;
    const ok = running && heartbeatFresh;
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok,
        host: HOST_ID,
        region: REGION,
        uptime_ms: uptime,
        cycles_total: cyclesTotal,
        cycles_failed: cyclesFailed,
        last_cycle_at: lastCycleAt ? new Date(lastCycleAt).toISOString() : null,
        last_heartbeat_at: lastHeartbeatAt
          ? new Date(lastHeartbeatAt).toISOString()
          : null,
        last_error: lastError,
      })
    );
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found\n");
});

// Bind explicitly to 0.0.0.0 so Fly's proxy can reach us — Fly containers
// need this even though modern Node's `listen(port, cb)` default *should*
// bind to all interfaces. The default has bitten enough people that Fly's
// docs recommend the explicit form.
healthServer.listen(PORT, "0.0.0.0", () => {
  log("info", "health-listening", { port: PORT, host: "0.0.0.0" });
});

// ── Heartbeat write ─────────────────────────────────────────────────

async function writeHeartbeat(): Promise<void> {
  try {
    await brainStore().upsertHeartbeat({
      host_id: HOST_ID,
      last_seen_at: new Date().toISOString(),
      uptime_ms: Date.now() - START,
      cycles_total: cyclesTotal,
      cycles_failed: cyclesFailed,
      last_error: lastError,
      last_cycle_summary: lastCycle
        ? {
            duration_ms: lastCycle.duration_ms,
            drafts: lastCycle.extracted_record_ids.length,
            checks: lastCycle.checked_records.length,
            contexts: lastCycle.contexts_assembled.length,
            errors: lastCycle.extraction_errors.length,
          }
        : null,
      metadata: {
        region: REGION,
        node: process.version,
        interval_ms: INTERVAL_MS,
      },
    });
    lastHeartbeatAt = Date.now();
  } catch (err) {
    log("warn", "heartbeat-failed", { error: (err as Error).message });
  }
}

// ── Main loop ───────────────────────────────────────────────────────

async function loop(): Promise<void> {
  log("info", "cloud-worker-boot", {
    interval_ms: INTERVAL_MS,
    heartbeat_ms: HEARTBEAT_MS,
    context_batch: CONTEXT_BATCH,
    checker_batch: CHECKER_BATCH,
    retry_batch: RETRY_BATCH,
  });

  // Initial heartbeat so the dashboard sees us immediately.
  await writeHeartbeat();

  while (running) {
    const started = Date.now();

    try {
      const cycle = await runOneCycle({
        context_batch: CONTEXT_BATCH,
        voice_batch: CONTEXT_BATCH,
        learning_batch: CONTEXT_BATCH,
        extractor_batch: CONTEXT_BATCH,
        checker_batch: CHECKER_BATCH,
        retry_batch: RETRY_BATCH,
      });

      cyclesTotal += 1;
      lastCycle = cycle;
      lastCycleAt = Date.now();
      lastError = null;

      const activity =
        cycle.contexts_assembled.length +
        cycle.voice_guides.length +
        cycle.learning_bundles.length +
        cycle.extracted_record_ids.length +
        cycle.checked_records.length;

      if (activity > 0) {
        log("info", "cycle-active", {
          ctx: cycle.contexts_assembled.length,
          voice: cycle.voice_guides.length,
          learn: cycle.learning_bundles.length,
          draft: cycle.extracted_record_ids.length,
          check: cycle.checked_records.length,
          retries: cycle.llm_retries.length,
          duration_ms: cycle.duration_ms,
        });
      }
    } catch (err) {
      cyclesFailed += 1;
      lastError = (err as Error).message.slice(0, 500);
      log("error", "cycle-failed", { error: lastError });
    }

    // Heartbeat on the wall clock, not the cycle count — that way an
    // exception-storming worker still tells the dashboard it's alive.
    if (Date.now() - lastHeartbeatAt >= HEARTBEAT_MS) {
      await writeHeartbeat();
    }

    const elapsed = Date.now() - started;
    const wait = Math.max(0, INTERVAL_MS - elapsed);
    // Sleep in 500ms chunks so SIGTERM is responsive.
    for (let waited = 0; waited < wait && running; waited += 500) {
      await new Promise((r) => setTimeout(r, Math.min(500, wait - waited)));
    }
  }

  // Final heartbeat on shutdown so the dashboard sees the last state.
  await writeHeartbeat();
  log("info", "cloud-worker-stopped", {
    cycles_total: cyclesTotal,
    cycles_failed: cyclesFailed,
    uptime_ms: Date.now() - START,
  });
  healthServer.close(() => process.exit(0));
}

loop().catch((err) => {
  log("error", "fatal-loop-exit", { error: (err as Error).message });
  process.exit(1);
});
