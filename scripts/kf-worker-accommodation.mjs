#!/usr/bin/env node
// scripts/kf-worker-accommodation.mjs
//
// Founder BEGIN Phase 2 · Accommodation Knowledge Factory Worker.
//
// Continuous · resumable · idempotent · heartbeat-driven · bounded-retry.
// Consumes its own rulebook every loop. Respects storage + generation
// governors. Writes heartbeat to nex.kf_worker_heartbeat.
//
// USAGE
//   node --env-file=.env.local scripts/kf-worker-accommodation.mjs
//
// ENV
//   KF_WORKER_INTERVAL_MS  (default 5000)  · sleep between loops
//   KF_WORKER_BATCH_SIZE   (default 500)   · variants generated per loop
//   KF_WORKER_MAX_RETRIES  (default 5)     · bounded retry
//   KF_WORKER_TARGET       (default 100000) · stops loop when reached
//
// STOP
//   Ctrl+C · SIGTERM · touch data/kf-worker-stop-<worker_id>

import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { makeAccommodationQuestionGenerator } from "../src/lib/nex/live-chat-completion/question-factory/accommodation-generator.js";
import { makeAccommodationVerifier } from "../src/lib/nex/live-chat-completion/question-factory/accommodation-verifier.js";
import { makeKnowledgeGapQueue } from "../src/lib/nex/live-chat-completion/knowledge-gap-queue.js";
import { checkStorageBudget, checkGenerationBudget } from "../src/lib/nex/live-chat-completion/governors.js";

const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_KF_POSTGRES_URL / NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, max: 8 });

const INTERVAL_MS   = Number(process.env.KF_WORKER_INTERVAL_MS ?? 5000);
const BATCH_SIZE    = Number(process.env.KF_WORKER_BATCH_SIZE ?? 500);
const MAX_RETRIES   = Number(process.env.KF_WORKER_MAX_RETRIES ?? 5);
const TARGET        = Number(process.env.KF_WORKER_TARGET ?? 100000);
const DOMAIN        = "accommodation";
const WORKER_ID     = `kf-${DOMAIN}-${process.pid}`;
const STOP_FLAG     = path.join(process.cwd(), "data", `kf-worker-stop-${WORKER_ID}`);

let shouldStop = false;
process.on("SIGINT",  () => { console.log("SIGINT · stopping after current loop"); shouldStop = true; });
process.on("SIGTERM", () => { console.log("SIGTERM · stopping after current loop"); shouldStop = true; });

// Persistent cursor between loops (in-memory + also DB-persisted via a "cursor" heartbeat metadata).
let cursor = null;
let consecutiveFailures = 0;
let loops = 0;

const gapQueue = makeKnowledgeGapQueue({ kfPool: pool });
const generator = makeAccommodationQuestionGenerator({ sourcePool: pool, kfPool: pool });
const verifier = makeAccommodationVerifier({
  sourcePool: pool,
  kfPool: pool,
  enqueueGap: async ({ entity_ref, intent_slug }) =>
    void await gapQueue.enqueue({ domain: DOMAIN, entity_ref, intent_slug, source: "verifier" }),
});

async function readRulebook() {
  const r = await pool.query(
    `SELECT question_variant_target, duplicate_rate_threshold_pct, bounded_retry_max
       FROM nex.master_rulebook WHERE domain = $1`,
    [DOMAIN],
  );
  return r.rowCount > 0 ? r.rows[0] : { question_variant_target: 1_000_000, duplicate_rate_threshold_pct: 30, bounded_retry_max: 5 };
}

async function writeHeartbeat(state, currentTask, extras = {}) {
  await pool.query(
    `INSERT INTO nex.kf_worker_heartbeat
       (worker_id, domain, worker_kind, state, current_task,
        last_success_at, last_failure_at, last_error, tasks_completed, tasks_failed, queue_depth, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     ON CONFLICT (worker_id) DO UPDATE SET
       state = EXCLUDED.state,
       current_task = EXCLUDED.current_task,
       last_success_at = COALESCE(EXCLUDED.last_success_at, nex.kf_worker_heartbeat.last_success_at),
       last_failure_at = COALESCE(EXCLUDED.last_failure_at, nex.kf_worker_heartbeat.last_failure_at),
       last_error = EXCLUDED.last_error,
       tasks_completed = EXCLUDED.tasks_completed,
       tasks_failed = EXCLUDED.tasks_failed,
       queue_depth = EXCLUDED.queue_depth,
       updated_at = now()`,
    [
      WORKER_ID, DOMAIN, "question_generator", state, currentTask,
      extras.last_success_at ?? null, extras.last_failure_at ?? null,
      extras.last_error ?? null,
      extras.tasks_completed ?? 0, extras.tasks_failed ?? 0,
      extras.queue_depth ?? 0,
    ],
  );
}

async function getStats() {
  const r = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE answer_status='candidate')::int AS candidate,
       COUNT(*) FILTER (WHERE answer_status='answered')::int AS answered,
       COUNT(*) FILTER (WHERE answer_status='unknown')::int AS unknown_count,
       COUNT(*) FILTER (WHERE answer_status='partially_answered')::int AS partial
     FROM nex.question_variant WHERE domain = $1`,
    [DOMAIN],
  );
  return r.rows[0];
}

console.log(`[kf-worker ${WORKER_ID}] starting · target=${TARGET} · batch=${BATCH_SIZE} · interval=${INTERVAL_MS}ms`);
await writeHeartbeat("RUNNING", "startup");

let tasksCompleted = 0;
let tasksFailed = 0;
let lastSuccessAt = null;
let lastFailureAt = null;

while (!shouldStop) {
  if (fs.existsSync(STOP_FLAG)) {
    console.log(`[kf-worker] stop flag present · exiting cleanly`);
    break;
  }

  loops++;
  try {
    // 1. Check rulebook + governors.
    const rulebook = await readRulebook();
    const storage = await checkStorageBudget(pool, DOMAIN);
    if (storage.pause_generation) {
      console.log(`[kf-worker loop ${loops}] PAUSED by storage governor: ${storage.reason}`);
      await writeHeartbeat("PAUSED", `storage:${storage.reason}`, {
        tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
      });
      await sleep(INTERVAL_MS);
      continue;
    }

    // 2. Coverage check.
    const stats = await getStats();
    if (stats.total >= TARGET && stats.candidate === 0) {
      console.log(`[kf-worker loop ${loops}] target ${TARGET} reached · idling`);
      await writeHeartbeat("IDLE", `target_reached:${stats.total}`, {
        tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
        queue_depth: stats.candidate,
      });
      await sleep(INTERVAL_MS * 4);
      continue;
    }

    // 3. Generate a batch (only if target not yet reached).
    // Generation governor may pause generation this loop, but verification
    // MUST still run to drain the candidate backlog.
    let generatedThisLoop = 0;
    let generationPaused = false;
    let generationPauseReason = null;
    if (stats.total < TARGET) {
      await writeHeartbeat("RUNNING", `generate·batch=${BATCH_SIZE}`, {
        tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
        queue_depth: stats.candidate,
      });
      const gres = await generator.generateBatch({ max_variants: BATCH_SIZE, cursor });
      const notes = gres.generation_notes.join(" ");
      const iMatch = notes.match(/inserted=(\d+)/);
      const uMatch = notes.match(/updated=(\d+)/);
      const bi = iMatch ? parseInt(iMatch[1], 10) : 0;
      const bu = uMatch ? parseInt(uMatch[1], 10) : 0;
      generatedThisLoop = bi;
      const genBudget = checkGenerationBudget({
        batch_inserted: bi, batch_updated: bu,
        rulebook_threshold_pct: Number(rulebook.duplicate_rate_threshold_pct),
      });
      if (genBudget.pause_generation) {
        generationPaused = true;
        generationPauseReason = genBudget.reason;
        // Advance cursor anyway so next generation attempt doesn't re-hit
        // the same entities. If we've exhausted every entity, reset.
        cursor = gres.next_cursor;
        if (gres.exhausted) cursor = null;
      } else {
        cursor = gres.next_cursor;
        if (gres.exhausted) {
          console.log(`[kf-worker loop ${loops}] generator exhausted · resetting cursor for next epoch`);
          cursor = null;
        }
      }
    }

    // 4. Verify a batch. Runs even when generation is paused so the
    // candidate backlog drains.
    await writeHeartbeat(generationPaused ? "DEGRADED" : "RUNNING", `verify·batch=${BATCH_SIZE}${generationPaused ? ` · gen_paused=${generationPauseReason}` : ""}`, {
      tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
      queue_depth: stats.candidate,
    });
    const vres = await verifier.verifyBatch({ max_variants: BATCH_SIZE });

    // 5. Loop bookkeeping.
    consecutiveFailures = 0;
    tasksCompleted++;
    lastSuccessAt = new Date().toISOString();
    console.log(`[kf-worker loop ${loops}] ok · generated=${generatedThisLoop}${generationPaused ? `(gen_paused:${generationPauseReason})` : ""} verified=${vres.results.length} remaining=${vres.remaining_candidates} · total=${stats.total}`);

    await writeHeartbeat("RUNNING", "idle_between_loops", {
      tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
      queue_depth: vres.remaining_candidates,
      last_success_at: lastSuccessAt,
    });
  } catch (e) {
    consecutiveFailures++;
    tasksFailed++;
    lastFailureAt = new Date().toISOString();
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[kf-worker loop ${loops}] failure (${consecutiveFailures}/${MAX_RETRIES}): ${msg}`);
    await writeHeartbeat("DEGRADED", `retry_${consecutiveFailures}`, {
      tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
      last_failure_at: lastFailureAt, last_error: msg.slice(0, 500),
    });
    if (consecutiveFailures >= MAX_RETRIES) {
      console.error(`[kf-worker] BOUNDED RETRY EXCEEDED · isolating (state=FAILED)`);
      await writeHeartbeat("FAILED", `bounded_retry_exceeded:${consecutiveFailures}`, {
        tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
        last_failure_at: lastFailureAt, last_error: msg.slice(0, 500),
      });
      break;
    }
  }

  await sleep(INTERVAL_MS);
}

console.log(`[kf-worker ${WORKER_ID}] shutting down · loops=${loops} completed=${tasksCompleted} failed=${tasksFailed}`);
await writeHeartbeat("IDLE", "shutdown", {
  tasks_completed: tasksCompleted, tasks_failed: tasksFailed,
});
await pool.end();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
