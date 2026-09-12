#!/usr/bin/env node
// NEX Acquisition Workforce · PRODUCTION SUPERVISOR.
//
// Philip 2026-09-02 · Phase 1A · continuous supervisor for the business
// acquisition workforce. Runs indefinitely. Spawns _category-walker.mjs
// cycles for each active job in data/nex-job-registry.json. Writes
// supervisor heartbeat + explicit waiting state declarations to
// nex.worker_heartbeat. Never crashes on uncaught exception (loop try/catch
// per Philip's non-negotiable rule).
//
// CORRECTIONS APPLIED (Philip 2026-09-02):
//   1. STALLED must mean real no-progress · supervisor DECLARES its own
//      waiting states so the watchdog does not misclassify legitimate
//      waiting-for-work as STALLED.
//   2. Cycle timeout is diagnostic-first · logs observations at 15/30 min ·
//      only kills at 60 min (configurable) with full diagnostic snapshot.
//
// BOUNDARIES:
//   · Uses existing nex.worker_heartbeat + nex.worker_cycle_run · no new schemas
//   · Uses existing _category-walker.mjs unchanged as the child worker
//   · Uses existing data/nex-job-registry.json for the job list
//   · Does not touch nex-dev-scheduler.mjs · System A · image migration · frame
//   · No Ollama · no Vision · no work_item table · no entity_processing_state
//
// LIFECYCLE:
//   Windows Scheduled Task NEX-Acquisition-Workforce
//     → run-production-launcher.mjs (bootstrap · tsx re-exec)
//     → run-production-watchdog.mjs (spawns this supervisor · restarts on STALLED/FAILED)
//     → run-production-supervisor.mjs (this file · continuous loop)
//     → _category-walker.mjs (one-shot per cycle · spawned by us)
//     → Postgres (nex.*_business tables)

import pg from "pg";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { statfs } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { requirePostgresUrl } from "../../src/lib/nex/config/production-guard.mjs";

// ═══════════════════════════════════════════════════════════════════════
// LEGACY WORKFORCE QUARANTINE · 2026-09-04 · fail-closed at boot
// ═══════════════════════════════════════════════════════════════════════
// Legacy Phase 1B supervisor. Superseded by workforce v2 (Gate 5A #4 proven).
// Defense-in-depth: even if someone spawns this file directly (bypassing
// the launcher + watchdog quarantines), execution is refused before any
// pg.Pool() call, before spawning _category-walker.mjs, before writing to
// nex.worker_heartbeat, nex.work_item, or nex.food_business. No env-var
// bypass. Edit source to revive. See run-production-launcher.mjs for full
// context.
// ═══════════════════════════════════════════════════════════════════════
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" NEX LEGACY WORKFORCE · QUARANTINED · run-production-supervisor.mjs\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" Legacy supervisor quarantined (2026-09-04). No DB connection, no\n");
process.stderr.write(" _category-walker spawn, no writes to nex.*. Exiting code 2.\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.exit(2);

// ═══════════════════════════════════════════════════════════════════════
// ORIGINAL FILE LOGIC PRESERVED BELOW (UNREACHABLE)
// ═══════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// ── Env / .env.local load (same convention as other NEX scripts) ─────
if (existsSync(join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Fail closed if NEX_POSTGRES_URL is missing / malformed / dev-URL in
// production. No silent fallback · a supervisor that boots against the
// wrong database is worse than one that refuses to start.
let NEX_POSTGRES_URL;
try {
  NEX_POSTGRES_URL = requirePostgresUrl();
} catch (err) {
  console.error(`[supervisor] FAIL-CLOSED · code=${err.code ?? "unknown"} · ${err.message}`);
  process.exit(2);
}

// ── Constants · all configurable via env · no CLI overrides ──────────
const SUPERVISOR_WORKER_ID = "acquisition-supervisor";
const SUPERVISOR_TICK_MS   = Number(process.env.NEX_ACQ_SUPERVISOR_TICK_MS   ?? 5_000);   // 5s heartbeat
const SUPERVISOR_KEEPALIVE_MS = Number(process.env.NEX_ACQ_SUPERVISOR_KEEPALIVE_MS ?? 15_000);  // 15s during long child-await windows (Philip 2026-09-02 · observability fix)
const CYCLE_GAP_MS         = Number(process.env.NEX_ACQ_CYCLE_GAP_MS         ?? 3_000);   // 3s polite floor between cycles
const CYCLE_MIN_GAP_MS     = Number(process.env.NEX_ACQ_CYCLE_MIN_GAP_MS     ?? 60_000);  // 60s min between same (worker,city) cycles
const CYCLE_TIMEOUT_MS     = Number(process.env.NEX_ACQ_CYCLE_TIMEOUT_MS     ?? 60 * 60_000);   // 60 min · generous · Philip correction 2
const CYCLE_OBS_15_MS      = Number(process.env.NEX_ACQ_CYCLE_OBS_15_MS      ?? 15 * 60_000);   // 15 min · observation
const CYCLE_WARN_30_MS     = Number(process.env.NEX_ACQ_CYCLE_WARN_30_MS     ?? 30 * 60_000);   // 30 min · warn
const DEFAULT_CITY         = process.env.NEX_ACQ_DEFAULT_CITY                ?? "Yogyakarta";  // Phase 1A: single-city rotation TBD later

const INCIDENT_LOG = join(repoRoot, "data", "nex-acquisition-workforce", "incidents.jsonl");
const JOB_REGISTRY = join(repoRoot, "data", "nex-job-registry.json");
const CATEGORY_WALKER_SCRIPT = join(repoRoot, "scripts", "nex-workforce", "_category-walker.mjs");

// ── State (in-memory · durable state lives in Postgres/registry) ─────
let signalAborted = false;
process.once("SIGINT",  () => { signalAborted = true; console.log("\n[supervisor] SIGINT received · will shut down after current tick"); });
process.once("SIGTERM", () => { signalAborted = true; console.log("\n[supervisor] SIGTERM received · will shut down after current tick"); });

function logIncident(kind, detail) {
  try {
    mkdirSync(dirname(INCIDENT_LOG), { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), kind, detail }) + "\n";
    appendFileSync(INCIDENT_LOG, line);
  } catch (_e) { /* incident logging must never crash the supervisor */ }
}

// ── Heartbeat helpers ────────────────────────────────────────────────
// Uses the SAME schema pattern as _category-walker.mjs writeHeartbeat (line 296-306).
async function writeSupervisorHeartbeat(pool, { status, context, cycleRunId = null }) {
  await pool.query(
    `INSERT INTO nex.worker_heartbeat (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id)
     VALUES ($1, $2, $3, now(), $4, $5::uuid)
     ON CONFLICT (worker_id) DO UPDATE SET
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       last_status       = EXCLUDED.last_status,
       last_cycle_run_id = EXCLUDED.last_cycle_run_id,
       worker_config     = EXCLUDED.worker_config`,
    [SUPERVISOR_WORKER_ID, "acquisition_supervisor", context, status, cycleRunId],
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 1B.2 · Work-item lifecycle helpers (Philip 2026-09-02)
// ═══════════════════════════════════════════════════════════════════════
//
// Wraps the existing spawn+wait cycle with a durable nex.work_item row.
// Lifecycle in this phase (happy path only):
//   queued → leased → running → completed
//
// Explicitly NOT handled in 1B.2 (deferred to 1B.3+):
//   · retrying / failed / dead_letter · reclaim of expired leases
//   · WAITING_FOR_NETWORK · Wi-Fi detection
//   · duplicate-attempt merging beyond ON CONFLICT DO NOTHING
//
// Idempotency bucket exactly per migration 143's documented semantics:
//   sha256(job_slug + '|' + city + '|' + bucket_seconds)
//   where bucket_seconds = floor(epoch / (CYCLE_MIN_GAP_MS/1000))
//
// Safety rules (Philip's design corrections):
//   · Never mark completed unless child exited code=0
//   · Never create fake productivity · fields copied only from real cycle_run row
//   · If work_item persistence fails, SKIP the walker spawn (do NOT run a cycle
//     whose durable record can't be created) · existing supervisor safety
//     (try/catch in main loop) contains the failure and continues.

const BUCKET_SECONDS = Math.floor(CYCLE_MIN_GAP_MS / 1000);
const WORK_ITEM_LEASE_MS = CYCLE_TIMEOUT_MS + 10 * 60_000; // cycle-timeout + 10 min headroom (bounded, honours long cycles)

// ─── Phase 1B.3 · retry policy constants (Philip 2026-09-02) ───
// Bounded deterministic exponential backoff · NO jitter (deterministic testing).
const RETRY_BASE_MS            = Number(process.env.NEX_ACQ_RETRY_BASE_MS       ?? 30_000);   // first backoff = 30s
const RETRY_MAX_BACKOFF_MS     = Number(process.env.NEX_ACQ_RETRY_MAX_BACKOFF_MS ?? 300_000);  // capped at 5 min
const ERROR_HISTORY_MAX_ENTRIES = 8;      // Philip design rule · max stored entries
const ERROR_HISTORY_MAX_CHARS   = 2048;   // per entry message cap (matches work_item.last_error CHECK)

function computeIdempotencyKey(jobSlug, city, nowMs = Date.now()) {
  const bucket = Math.floor(nowMs / 1000 / BUCKET_SECONDS);
  return createHash("sha256")
    .update(`${jobSlug}|${city}|${bucket}`, "utf8")
    .digest("hex");
}

// Insert queued · returns { workItemId, idempotencyKey, alreadyExists } · never throws
// on ON CONFLICT · rethrows on other errors so the caller can decide.
async function workItemEnqueue(pool, { jobSlug, city }) {
  const workItemId = randomUUID();
  const idempotencyKey = computeIdempotencyKey(jobSlug, city);
  const res = await pool.query(
    `INSERT INTO nex.work_item (
       work_item_id, idempotency_key, job_slug, city, status,
       max_attempts, created_at, updated_at
     ) VALUES ($1::uuid, $2, $3, $4, 'queued', 4, now(), now())
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING work_item_id`,
    [workItemId, idempotencyKey, jobSlug, city],
  );
  if (res.rows.length === 0) {
    return { workItemId: null, idempotencyKey, alreadyExists: true };
  }
  return { workItemId: res.rows[0].work_item_id, idempotencyKey, alreadyExists: false };
}

async function workItemLease(pool, { workItemId, leaseOwner, walkerWorkerId }) {
  const leaseExpiresAt = new Date(Date.now() + WORK_ITEM_LEASE_MS);
  await pool.query(
    `UPDATE nex.work_item
        SET status='leased',
            worker_id=$1::uuid,
            lease_owner=$2,
            lease_expires_at=$3,
            updated_at=now()
      WHERE work_item_id=$4::uuid AND status='queued'`,
    [walkerWorkerId, leaseOwner, leaseExpiresAt, workItemId],
  );
}

async function workItemMarkRunning(pool, { workItemId }) {
  await pool.query(
    `UPDATE nex.work_item
        SET status='running',
            started_at=now(),
            updated_at=now()
      WHERE work_item_id=$1::uuid AND status='leased'`,
    [workItemId],
  );
}

// Look up the child walker's actual nex.worker_cycle_run row (the walker
// generates its own randomUUID cycle_run_id · we discover it after exit
// by matching worker_type + worker_config + started_at ≥ our spawn marker).
async function fetchWalkerCycleRun(pool, { jobSlug, city, sinceIso }) {
  const q = await pool.query(
    `SELECT id, records_processed, records_new, summary
       FROM nex.worker_cycle_run
      WHERE worker_type = $1 AND worker_config = $2
        AND started_at >= $3 AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1`,
    [`category:${jobSlug}`, `${jobSlug}:${city}:overpass`, sinceIso],
  );
  return q.rows[0] ?? null;
}

// Mark completed with TRUTHFUL data copied from the walker's own cycle_run.
// Only fields the walker actually reported are populated. Fields that the
// walker did not report remain NULL (no fake productivity).
async function workItemComplete(pool, { workItemId, cycleRun }) {
  const cycleOutcome = cycleRun?.summary?.cycle_outcome ?? null;
  await pool.query(
    `UPDATE nex.work_item
        SET status='completed',
            cycle_run_id=$1::uuid,
            records_processed=$2,
            records_new=$3,
            cycle_outcome=$4,
            finished_at=now(),
            lease_owner=NULL,
            lease_expires_at=NULL,
            updated_at=now()
      WHERE work_item_id=$5::uuid AND status='running'`,
    [
      cycleRun?.id ?? null,
      cycleRun?.records_processed ?? null,
      cycleRun?.records_new ?? null,
      cycleOutcome,
      workItemId,
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 1B.3 · failure state machine (Philip 2026-09-02)
// ═══════════════════════════════════════════════════════════════════════
//
// running → retrying    (attempts remain · bounded exponential backoff)
// running → dead_letter (max_attempts exhausted)
// retrying → leased     (via retry sweep at loop top · same work_item · attempt_count++)
//
// Explicitly NOT handled in 1B.3 (per Philip's boundaries):
//   · expired-lease reclaim (1B.4)
//   · WAITING_FOR_NETWORK (1B.5)
//   · watchdog kill/threshold changes

// Truncate error message to bounded length (matches work_item.last_error CHECK).
function truncateErrorMessage(msg) {
  if (msg == null) return "";
  const s = String(msg);
  if (s.length <= ERROR_HISTORY_MAX_CHARS) return s;
  return s.slice(0, ERROR_HISTORY_MAX_CHARS - 1) + "…";
}

// Classify walker outcome into stable class labels.
// Legitimate walker results (ALL_DEDUPED / PROVIDER_EMPTY / COMPLETED) are NOT
// failures · they exit code=0 and take the completion path · we never see them here.
function classifyOutcome(outcome) {
  if (outcome?.error) return { class: "INTERNAL", message: `spawn error: ${outcome.error}` };
  if (outcome?.killed) {
    // supervisor-side kill (currently only from cycle_timeout · Phase 1A)
    return { class: "TIMEOUT", message: `killed: ${outcome.killReason ?? "unknown"}` };
  }
  if (outcome?.exitSignal) {
    // OS-level termination (e.g. SIGTERM from external taskkill)
    return { class: "PROCESS_EXIT", message: `signal=${outcome.exitSignal}` };
  }
  if (typeof outcome?.exitCode === "number" && outcome.exitCode !== 0) {
    return { class: "PROCESS_EXIT", message: `code=${outcome.exitCode}` };
  }
  return { class: "INTERNAL", message: `unknown failure (exitCode=${outcome?.exitCode ?? "null"})` };
}

// Deterministic exponential backoff · no jitter · capped.
function computeBackoffMs(nextAttemptCount) {
  const raw = RETRY_BASE_MS * Math.pow(2, nextAttemptCount - 1);
  return Math.min(raw, RETRY_MAX_BACKOFF_MS);
}

// Record a failure on the work_item · transitions running → retrying or dead_letter.
// Reuses the SAME work_item row · never creates a duplicate · lease cleared.
async function workItemRecordFailure(pool, { workItemId, errorClass, errorMessage }) {
  // Load current attempt_count, max_attempts, error_history in a single query
  const cur = await pool.query(
    `SELECT attempt_count, max_attempts, error_history
       FROM nex.work_item WHERE work_item_id = $1::uuid`,
    [workItemId],
  );
  if (cur.rows.length === 0) {
    logIncident("work_item_failure_row_missing", { workItemId });
    return { newStatus: null };
  }
  const row = cur.rows[0];
  const truncated = truncateErrorMessage(errorMessage);
  const newAttemptCount = row.attempt_count + 1;
  const hasAttemptsLeft = newAttemptCount < row.max_attempts;
  const newStatus = hasAttemptsLeft ? "retrying" : "dead_letter";
  const nextRetryAt = hasAttemptsLeft ? new Date(Date.now() + computeBackoffMs(newAttemptCount)) : null;

  const historyEntry = { at: new Date().toISOString(), attempt: newAttemptCount, class: errorClass, message: truncated };
  const priorHistory = Array.isArray(row.error_history) ? row.error_history : [];
  const newHistory = [historyEntry, ...priorHistory].slice(0, ERROR_HISTORY_MAX_ENTRIES);

  await pool.query(
    `UPDATE nex.work_item
        SET status=$1,
            attempt_count=$2,
            last_error=$3,
            last_error_class=$4,
            error_history=$5::jsonb,
            next_retry_at=$6,
            lease_owner=NULL,
            lease_expires_at=NULL,
            updated_at=now()
      WHERE work_item_id=$7::uuid AND status='running'`,
    [newStatus, newAttemptCount, truncated, errorClass, JSON.stringify(newHistory), nextRetryAt, workItemId],
  );
  return { newStatus, attemptCount: newAttemptCount, maxAttempts: row.max_attempts, nextRetryAt };
}

// Retry sweep · picks the single most-due retrying work_item.
// Returns { workItemId, jobSlug, city, attemptCount, maxAttempts } or null.
async function findEligibleRetry(pool) {
  const res = await pool.query(
    `SELECT work_item_id, job_slug, city, attempt_count, max_attempts
       FROM nex.work_item
      WHERE status='retrying' AND next_retry_at <= now()
      ORDER BY next_retry_at ASC
      LIMIT 1`,
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    workItemId: r.work_item_id,
    jobSlug: r.job_slug,
    city: r.city,
    attemptCount: r.attempt_count,
    maxAttempts: r.max_attempts,
  };
}

// Reclaim a retrying row into leased for the next attempt. Uses the SAME
// work_item row · no new INSERT · no new idempotency key.
async function workItemLeaseRetry(pool, { workItemId, leaseOwner, walkerWorkerId }) {
  const leaseExpiresAt = new Date(Date.now() + WORK_ITEM_LEASE_MS);
  const res = await pool.query(
    `UPDATE nex.work_item
        SET status='leased',
            worker_id=$1::uuid,
            lease_owner=$2,
            lease_expires_at=$3,
            updated_at=now()
      WHERE work_item_id=$4::uuid AND status='retrying'
      RETURNING work_item_id`,
    [walkerWorkerId, leaseOwner, leaseExpiresAt, workItemId],
  );
  return res.rows.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 1B.4 · Lease reclaim + stranded work recovery (Philip 2026-09-02)
// ═══════════════════════════════════════════════════════════════════════
//
// Reclaims work_items whose lease has expired · returns them to retrying
// (attempts remain) or dead_letter (attempts exhausted) using the SAME
// work_item row (no new INSERT · no duplicate idempotency key).
//
// SAFETY:
//   · Bounded batch (RECLAIM_BATCH_LIMIT per tick) · never unbounded scan
//   · Atomic UPDATE ... RETURNING with the expired-lease guard IN the
//     WHERE clause · concurrency-safe (second racer sees 0 rows)
//   · Only fires on lease_expires_at < now() · never steals active work
//   · Reuses 1B.3 computeBackoffMs · no new retry policy
//   · Reuses 1B.3 error_history bounds (8 entries · 2048 char cap)
//   · Never touches nex.worker_cycle_run · never touches the 14 zombie rows
//   · Preserves work_item_id · idempotency_key · job_slug · city · max_attempts · created_at

const RECLAIM_BATCH_LIMIT = Number(process.env.NEX_ACQ_RECLAIM_BATCH_LIMIT ?? 10);
const RECLAIM_ERROR_CLASS = "LEASE_EXPIRED";

async function reclaimExpiredLeases(pool) {
  // Find candidates (bounded LIMIT · never unbounded)
  const candidates = await pool.query(
    `SELECT work_item_id, job_slug, city, status, worker_id, lease_owner, lease_expires_at,
            attempt_count, max_attempts, error_history
       FROM nex.work_item
      WHERE status IN ('leased', 'running')
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < now()
      ORDER BY lease_expires_at ASC
      LIMIT $1`,
    [RECLAIM_BATCH_LIMIT],
  );

  const reclaimed = [];
  for (const row of candidates.rows) {
    const newAttemptCount = row.attempt_count + 1;
    const hasAttemptsLeft = newAttemptCount < row.max_attempts;
    const newStatus = hasAttemptsLeft ? "retrying" : "dead_letter";
    const nextRetryAt = hasAttemptsLeft ? new Date(Date.now() + computeBackoffMs(newAttemptCount)) : null;

    const errorMessage = truncateErrorMessage(
      `lease expired · previous lease_owner=${row.lease_owner ?? "null"} · previous_status=${row.status} · expired_at=${new Date(row.lease_expires_at).toISOString()}`,
    );
    const historyEntry = {
      at: new Date().toISOString(),
      attempt: newAttemptCount,
      class: RECLAIM_ERROR_CLASS,
      message: errorMessage,
    };
    const priorHistory = Array.isArray(row.error_history) ? row.error_history : [];
    const newHistory = [historyEntry, ...priorHistory].slice(0, ERROR_HISTORY_MAX_ENTRIES);

    // Atomic guarded UPDATE with RETURNING · the RETURNING row IS the reclaim proof.
    // If another supervisor tick reclaimed this row first (or the lease was refreshed),
    // the WHERE clause no longer matches · UPDATE returns 0 rows · we do nothing.
    const result = await pool.query(
      `UPDATE nex.work_item
          SET status=$1,
              attempt_count=$2,
              last_error=$3,
              last_error_class=$4,
              error_history=$5::jsonb,
              next_retry_at=$6,
              lease_owner=NULL,
              lease_expires_at=NULL,
              updated_at=now()
        WHERE work_item_id=$7::uuid
          AND status IN ('leased', 'running')
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < now()
        RETURNING work_item_id, status, attempt_count, max_attempts, next_retry_at`,
      [
        newStatus, newAttemptCount, errorMessage, RECLAIM_ERROR_CLASS,
        JSON.stringify(newHistory), nextRetryAt, row.work_item_id,
      ],
    );

    if (result.rows.length === 1) {
      logIncident("lease_expired_reclaim", {
        workItemId: row.work_item_id,
        jobSlug: row.job_slug,
        city: row.city,
        oldLeaseOwner: row.lease_owner,
        oldLeaseExpiresAt: row.lease_expires_at,
        oldStatus: row.status,
        newStatus: result.rows[0].status,
        attemptCount: result.rows[0].attempt_count,
        maxAttempts: result.rows[0].max_attempts,
        nextRetryAt: result.rows[0].next_retry_at,
        reason: RECLAIM_ERROR_CLASS,
      });
      reclaimed.push(result.rows[0]);
    }
    // else: another supervisor beat us to this row (0 returned rows · silent no-op)
  }
  return reclaimed;
}

// ── Job loading ──────────────────────────────────────────────────────
function loadActiveJobs() {
  try {
    const raw = JSON.parse(readFileSync(JOB_REGISTRY, "utf8"));
    const jobs = raw.jobs ?? [];
    // Phase 1A treats every job as active by default (registry has no status column yet).
    // If a job explicitly declares status='disabled' or 'paused', skip it.
    return jobs.filter((j) => {
      if (j.status && (j.status === "disabled" || j.status === "paused")) return false;
      if (!j.category_slug || !j.target_table) return false;
      return true;
    });
  } catch (e) {
    logIncident("job_registry_load_failed", { message: e.message });
    return [];
  }
}

// ── Cycle spawner ────────────────────────────────────────────────────
// Spawns _category-walker.mjs as a child · waits for exit · returns outcome
// with diagnostic snapshot at 15/30/60 min marks. Uses SIGTERM then SIGKILL
// only at CYCLE_TIMEOUT_MS with full diagnostic incident log.
async function runOneCycle(pool, job, city) {
  const cycleStartMs = Date.now();
  const cycleTag = `${job.category_slug}:${city}`;
  console.log(`[${new Date().toISOString()}] [supervisor] spawn cycle · ${cycleTag}`);

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        CATEGORY_WALKER_SCRIPT,
        `--category=${job.category_slug}`,
        `--city=${city}`,
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
        env: { ...process.env },
      },
    );

    let killed = false;
    let killReason = null;
    const observations = [];
    const timers = [];

    // 15-min OBSERVATION (no kill)
    timers.push(setTimeout(async () => {
      const elapsedMs = Date.now() - cycleStartMs;
      const snap = { at: new Date().toISOString(), kind: "cycle_observation_15m", cycleTag, pid: child.pid, elapsedMs };
      observations.push(snap);
      logIncident("cycle_observation_15m", snap);
      console.log(`[${snap.at}] [supervisor] OBSERVATION · ${cycleTag} · pid=${child.pid} · elapsed=${(elapsedMs / 1000).toFixed(0)}s · not killing`);
    }, CYCLE_OBS_15_MS));

    // 30-min WARN (no kill)
    timers.push(setTimeout(async () => {
      const elapsedMs = Date.now() - cycleStartMs;
      const snap = { at: new Date().toISOString(), kind: "cycle_warn_30m", cycleTag, pid: child.pid, elapsedMs };
      observations.push(snap);
      logIncident("cycle_warn_30m", snap);
      console.log(`[${snap.at}] [supervisor] WARN · ${cycleTag} · pid=${child.pid} · elapsed=${(elapsedMs / 1000).toFixed(0)}s · not killing`);
    }, CYCLE_WARN_30_MS));

    // 60-min TIMEOUT (kill with diagnostic snapshot)
    timers.push(setTimeout(async () => {
      const elapsedMs = Date.now() - cycleStartMs;
      killed = true;
      killReason = "cycle_timeout";
      const snap = {
        at: new Date().toISOString(),
        kind: "cycle_timeout_kill",
        cycleTag, pid: child.pid, cycleStartAt: new Date(cycleStartMs).toISOString(),
        elapsedMs, observations, killReason,
      };
      logIncident("cycle_timeout_kill", snap);
      console.error(`[${snap.at}] [supervisor] KILL · ${cycleTag} · pid=${child.pid} · elapsed=${(elapsedMs / 1000).toFixed(0)}s`);
      try {
        child.kill("SIGTERM");
        setTimeout(() => { try { if (!child.killed) child.kill("SIGKILL"); } catch {} }, 10_000);
      } catch (e) { logIncident("cycle_kill_error", { cycleTag, error: e.message }); }
    }, CYCLE_TIMEOUT_MS));

    child.on("exit", (code, signal) => {
      for (const t of timers) clearTimeout(t);
      const elapsedMs = Date.now() - cycleStartMs;
      const outcome = {
        cycleTag, pid: child.pid,
        exitCode: code, exitSignal: signal,
        killed, killReason,
        elapsedMs,
        observations,
      };
      if (killed) logIncident("cycle_child_exit_after_kill", outcome);
      else console.log(`[${new Date().toISOString()}] [supervisor] cycle exit · ${cycleTag} · code=${code} · signal=${signal} · elapsed=${(elapsedMs / 1000).toFixed(0)}s`);
      resolve(outcome);
    });

    child.on("error", (e) => {
      for (const t of timers) clearTimeout(t);
      logIncident("cycle_spawn_error", { cycleTag, error: e.message });
      resolve({ cycleTag, error: e.message, elapsedMs: Date.now() - cycleStartMs });
    });
  });
}

// ── Recent-cycle guard ───────────────────────────────────────────────
// Skip a (job × city) cycle if a completed cycle_run for it exists within CYCLE_MIN_GAP_MS.
// Prevents hammering the same (category, city) faster than politeness allows.
async function recentlyCycled(pool, job, city) {
  const q = await pool.query(
    `SELECT MAX(finished_at) AS last
       FROM nex.worker_cycle_run
      WHERE worker_type = $1 AND worker_config = $2
        AND status = 'completed'
        AND finished_at > now() - ($3::bigint || ' milliseconds')::interval`,
    [`category:${job.category_slug}`, `${job.category_slug}:${city}:overpass`, CYCLE_MIN_GAP_MS],
  );
  return q.rows[0]?.last != null;
}

// ── Main supervisor loop ─────────────────────────────────────────────
(async () => {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" NEX ACQUISITION WORKFORCE · PRODUCTION SUPERVISOR");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(` Postgres: ${NEX_POSTGRES_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log(` Tick every: ${SUPERVISOR_TICK_MS}ms`);
  console.log(` Cycle timeout: ${CYCLE_TIMEOUT_MS}ms (60 min · observation-first)`);
  console.log(` Default city: ${DEFAULT_CITY}`);
  console.log(` Incident log: ${INCIDENT_LOG}`);
  console.log("");

  const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 3 });

  // Startup heartbeat (STARTING window)
  try { await writeSupervisorHeartbeat(pool, { status: "running", context: "supervisor_starting" }); }
  catch (e) { console.error(`[supervisor] initial heartbeat failed: ${e.message}`); logIncident("initial_heartbeat_failed", { error: e.message }); }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 1B.3 · dead_letter boundary TEST SEAM (Philip 2026-09-02 Path A)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // STRICT SAFETY (all must hold to fire):
  //   1. NEX_ACQ_TEST_MODE=1               explicit test-mode marker
  //   2. NEX_ACQ_TEST_FAIL_ONCE=1          one-shot trigger
  //   3. process is NOT watchdog-spawned   (blocks accidental persistent env-var
  //                                         setting from causing an infinite
  //                                         watchdog-restart loop)
  //
  // Absent any of these → zero effect on production behaviour.
  //
  // MECHANISM:
  //   · Uses walker's existing deterministic invalid-slug failure path
  //     (_category-walker.mjs line 363 jobBySlug throws → line 583 top-level
  //      catch → process.exit(1)) · no walker modification.
  //   · Test work_item created via the SAME workItemEnqueue helper as every
  //     production cycle (not a bare-SQL INSERT bypass) · self-identifying
  //     via job_slug='nex-test-invalid-job' which cannot collide with any real
  //     job registry entry.
  //   · max_attempts=1 override applied to the same row so first (and only)
  //     failure crosses the boundary attempts_count(1) >= max_attempts(1)
  //     → dead_letter, using the same workItemRecordFailure code path
  //     as any production failure. Retry/dead_letter logic is NOT weakened.
  //   · One-shot: NEX_ACQ_TEST_FAIL_ONCE is deleted from process.env
  //     immediately on activation · this in-process delete does NOT clear a
  //     persistent user/system env var. Persistent env vars MUST NEVER be set.
  //   · After the test cycle completes, this supervisor process exits cleanly
  //     with code 0. Manual invocation only · watchdog-supervised supervisors
  //     will hit the safety guard above and refuse to fire.
  if (process.env.NEX_ACQ_TEST_MODE === "1" && process.env.NEX_ACQ_TEST_FAIL_ONCE === "1") {
    if (process.env.__ACQ_WATCHDOG_SUPERVISED__ === "1") {
      console.error("[test-seam] REFUSING · test env vars set on watchdog-supervised supervisor · would cause infinite restart loop · unset persistent env vars");
      logIncident("test_seam_refused_watchdog_supervised", {
        at: new Date().toISOString(),
        note: "NEX_ACQ_TEST_MODE + NEX_ACQ_TEST_FAIL_ONCE set on watchdog-spawned supervisor · test seam refused to prevent infinite restart loop",
      });
      // Fall through to normal loop
    } else {
      delete process.env.NEX_ACQ_TEST_FAIL_ONCE; // in-process one-shot consume
      const testJobSlug = "nex-test-invalid-job";
      const testCity = DEFAULT_CITY;
      console.log(`[test-seam] activated · testJobSlug=${testJobSlug} · testCity=${testCity}`);
      logIncident("test_seam_dead_letter_activated", { at: new Date().toISOString(), testJobSlug, testCity });

      try {
        const enq = await workItemEnqueue(pool, { jobSlug: testJobSlug, city: testCity });
        if (enq.alreadyExists) {
          logIncident("test_seam_idempotency_collision", { testJobSlug, testCity, idempotencyKey: enq.idempotencyKey, note: "test run in same minute-bucket as prior · skipping" });
          console.log(`[test-seam] idempotency collision · skipping (retry in next bucket)`);
        } else {
          // Override max_attempts=1 on the newly-created test work_item so first failure hits dead_letter boundary
          await pool.query(
            `UPDATE nex.work_item SET max_attempts=1, updated_at=now() WHERE work_item_id=$1::uuid AND status='queued' AND job_slug=$2`,
            [enq.workItemId, testJobSlug],
          );

          const walkerWorkerId = randomUUID();
          await workItemLease(pool, { workItemId: enq.workItemId, leaseOwner: `test-runner@${process.pid}`, walkerWorkerId });
          await workItemMarkRunning(pool, { workItemId: enq.workItemId });

          const testJob = { category_slug: testJobSlug };
          const outcome = await runOneCycle(pool, testJob, testCity);
          const classified = classifyOutcome(outcome);
          const result = await workItemRecordFailure(pool, {
            workItemId: enq.workItemId,
            errorClass: classified.class,
            errorMessage: classified.message,
          });

          logIncident("test_seam_dead_letter_completed", {
            at: new Date().toISOString(),
            workItemId: enq.workItemId, testJobSlug, testCity,
            walkerExitCode: outcome?.exitCode, walkerExitSignal: outcome?.exitSignal,
            errorClass: classified.class,
            newStatus: result?.newStatus,
            attemptCount: result?.attemptCount,
            maxAttempts: result?.maxAttempts,
          });
          console.log(`[test-seam] completed · work_item=${enq.workItemId} · walker exit=${outcome?.exitCode} · newStatus=${result?.newStatus} · attempt=${result?.attemptCount}/${result?.maxAttempts}`);
        }
      } catch (e) {
        console.error(`[test-seam] ERROR: ${e.message}`);
        logIncident("test_seam_dead_letter_error", { at: new Date().toISOString(), error: e.message, stack: e.stack?.slice(0, 500) });
      }

      console.log("[test-seam] this supervisor was a test invocation · exiting cleanly (do not enter main loop)");
      try { await pool.end(); } catch { /* ignore */ }
      process.exit(0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 1B.4 · exhausted-lease reclaim TEST SEAM (Path A pattern)
  // ═══════════════════════════════════════════════════════════════════════
  // Same two-factor + watchdog-refuse guard as 1B.3.
  // Requires: NEX_ACQ_TEST_MODE=1 AND NEX_ACQ_TEST_STRAND_ONCE=1
  // Creates a stranded work_item via SAME workItemEnqueue path then UPDATEs
  // it to status='running' with attempt_count=0, max_attempts=1, and an
  // expired lease · then invokes reclaimExpiredLeases and verifies the row
  // reaches dead_letter (attempts 0+1=1 = max_attempts 1).
  if (process.env.NEX_ACQ_TEST_MODE === "1" && process.env.NEX_ACQ_TEST_STRAND_ONCE === "1") {
    if (process.env.__ACQ_WATCHDOG_SUPERVISED__ === "1") {
      console.error("[test-seam] REFUSING strand · env vars set on watchdog-supervised supervisor · would cause infinite restart loop · unset persistent env vars");
      logIncident("test_seam_strand_refused_watchdog_supervised", {
        at: new Date().toISOString(),
        note: "NEX_ACQ_TEST_MODE + NEX_ACQ_TEST_STRAND_ONCE on watchdog-spawned supervisor · refused",
      });
    } else {
      delete process.env.NEX_ACQ_TEST_STRAND_ONCE; // in-process one-shot consume
      const testJobSlug = "nex-test-strand";
      const testCity = DEFAULT_CITY;
      console.log(`[test-seam] strand-exhausted activated · testJobSlug=${testJobSlug} · testCity=${testCity}`);
      logIncident("test_seam_strand_activated", { at: new Date().toISOString(), testJobSlug, testCity });

      try {
        // Create work_item via SAME normal enqueue path (no bare INSERT bypass)
        const enq = await workItemEnqueue(pool, { jobSlug: testJobSlug, city: testCity });
        if (enq.alreadyExists) {
          logIncident("test_seam_strand_idempotency_collision", { testJobSlug, testCity, idempotencyKey: enq.idempotencyKey });
          console.log(`[test-seam] strand idempotency collision · skipping (retry in next bucket)`);
        } else {
          // Strand it: queued → running with expired lease, max_attempts=1, attempt_count=0
          const stranderWorkerId = randomUUID();
          const pastLease = new Date(Date.now() - 10 * 60 * 1000); // 10 min in the past
          await pool.query(
            `UPDATE nex.work_item
                SET status='running',
                    worker_id=$1::uuid,
                    lease_owner=$2,
                    lease_expires_at=$3,
                    max_attempts=1,
                    started_at=now(),
                    updated_at=now()
              WHERE work_item_id=$4::uuid AND status='queued' AND job_slug=$5`,
            [stranderWorkerId, `test-runner-strand@${process.pid}`, pastLease, enq.workItemId, testJobSlug],
          );

          // Now invoke reclaimExpiredLeases · target should transition to dead_letter
          const reclaimed = await reclaimExpiredLeases(pool);
          const target = reclaimed.find((r) => r.work_item_id === enq.workItemId);

          logIncident("test_seam_strand_completed", {
            at: new Date().toISOString(),
            workItemId: enq.workItemId, testJobSlug, testCity, idempotencyKey: enq.idempotencyKey,
            targetReclaimed: !!target,
            newStatus: target?.status,
            attemptCount: target?.attempt_count,
            maxAttempts: target?.max_attempts,
            nextRetryAt: target?.next_retry_at,
            totalReclaimedThisSweep: reclaimed.length,
          });
          console.log(`[test-seam] strand-exhausted completed · work_item=${enq.workItemId} · newStatus=${target?.status} · attempt=${target?.attempt_count}/${target?.max_attempts}`);
        }
      } catch (e) {
        console.error(`[test-seam] strand ERROR: ${e.message}`);
        logIncident("test_seam_strand_error", { at: new Date().toISOString(), error: e.message, stack: e.stack?.slice(0, 500) });
      }

      console.log("[test-seam] strand-exhausted supervisor was a test invocation · exiting cleanly");
      try { await pool.end(); } catch { /* ignore */ }
      process.exit(0);
    }
  }

  while (!signalAborted) {
    try {
      // ─── Disk-space safety guard · Philip 2026-09-03 ───
      // Skip cycles when free disk drops below MIN_FREE_DISK_GB (default 2 GB).
      // Prevents the 2026-09-02 cascade (Postgres "no space left on device"
      // → tick_error spin → supervisor death → 28 zombie cycle_runs).
      // Fails OPEN when statfs unavailable so it never blocks work spuriously.
      const freeGB = await getFreeDiskGB();
      if (freeGB !== null && freeGB < MIN_FREE_DISK_GB) {
        const ctx = `disk_low · free=${freeGB.toFixed(2)}GB · threshold=${MIN_FREE_DISK_GB}GB`;
        try { await writeSupervisorHeartbeat(pool, { status: "paused", context: ctx }); } catch {}
        logIncident("disk_low", { free_gb: Number(freeGB.toFixed(3)), threshold_gb: MIN_FREE_DISK_GB });
        console.log(`[${new Date().toISOString()}] [safety] PAUSED · ${ctx} · sleeping ${SUPERVISOR_TICK_MS * 6}ms`);
        await sleep(SUPERVISOR_TICK_MS * 6);
        continue;
      }

      // ─── Phase 1B.4 · lease reclaim sweep · runs BEFORE retry sweep and fresh rotation ───
      // Bounded batch (RECLAIM_BATCH_LIMIT rows per tick) · atomic guarded UPDATE ... RETURNING per row.
      // Never touches active leases. Reclaimed rows enter retrying (or dead_letter if exhausted).
      try {
        const reclaimed = await reclaimExpiredLeases(pool);
        if (reclaimed.length > 0) {
          console.log(`[${new Date().toISOString()}] [reclaim] reclaimed ${reclaimed.length} expired-lease work_item(s)`);
        }
      } catch (e) {
        logIncident("reclaim_scan_error", { error: e.message });
      }

      const jobs = loadActiveJobs();

      if (jobs.length === 0) {
        await writeSupervisorHeartbeat(pool, { status: "waiting", context: "waiting_for_work · no active jobs in registry" });
        await sleep(SUPERVISOR_TICK_MS);
        continue;
      }

      // ─── Phase 1B.3 · retry sweep · process one eligible retry per round ───
      // Reuses the SAME work_item · no duplicates · attempt_count increments on completion of THIS attempt.
      // Falls through to the normal fresh-job rotation when no retry is due.
      try {
        const retry = await findEligibleRetry(pool);
        if (retry) {
          const job = jobs.find((j) => j.category_slug === retry.jobSlug);
          if (!job) {
            logIncident("retry_job_not_in_registry", { workItemId: retry.workItemId, jobSlug: retry.jobSlug });
          } else if (!signalAborted) {
            const city = retry.city;
            await writeSupervisorHeartbeat(pool, { status: "running", context: `retry:${retry.jobSlug}:${city} attempt=${retry.attemptCount + 1}/${retry.maxAttempts}` });
            const walkerWorkerId = randomUUID();
            const leased = await workItemLeaseRetry(pool, {
              workItemId: retry.workItemId,
              leaseOwner: `acquisition-supervisor@${process.pid}`,
              walkerWorkerId,
            });
            if (leased) {
              await workItemMarkRunning(pool, { workItemId: retry.workItemId });
              // Keep-alive during retry cycle (same pattern as fresh path)
              const keepAliveTimer = setInterval(() => {
                writeSupervisorHeartbeat(pool, { status: "running", context: `retry:${retry.jobSlug}:${city} attempt=${retry.attemptCount + 1}/${retry.maxAttempts}` })
                  .catch((e) => logIncident("supervisor_keepalive_heartbeat_error", { cycleTag: `${retry.jobSlug}:${city}`, error: e.message }));
              }, SUPERVISOR_KEEPALIVE_MS);
              const cycleSpawnAt = new Date();
              let outcome;
              try { outcome = await runOneCycle(pool, job, city); } finally { clearInterval(keepAliveTimer); }

              if (outcome && outcome.exitCode === 0 && !outcome.killed) {
                try {
                  const cycleRun = await fetchWalkerCycleRun(pool, { jobSlug: retry.jobSlug, city, sinceIso: cycleSpawnAt.toISOString() });
                  await workItemComplete(pool, { workItemId: retry.workItemId, cycleRun });
                  logIncident("work_item_retry_succeeded", { workItemId: retry.workItemId, jobSlug: retry.jobSlug, city, attemptCount: retry.attemptCount + 1 });
                } catch (e) {
                  logIncident("work_item_completion_error", { workItemId: retry.workItemId, jobSlug: retry.jobSlug, city, error: e.message });
                }
              } else {
                const classified = classifyOutcome(outcome);
                try {
                  const result = await workItemRecordFailure(pool, { workItemId: retry.workItemId, errorClass: classified.class, errorMessage: classified.message });
                  logIncident("work_item_retry_failed", {
                    workItemId: retry.workItemId, jobSlug: retry.jobSlug, city,
                    errorClass: classified.class, attemptCount: result.attemptCount, maxAttempts: result.maxAttempts,
                    newStatus: result.newStatus, nextRetryAt: result.nextRetryAt,
                  });
                } catch (e) {
                  logIncident("work_item_failure_record_error", { workItemId: retry.workItemId, jobSlug: retry.jobSlug, city, error: e.message });
                }
              }
              if (CYCLE_GAP_MS > 0 && !signalAborted) await sleep(CYCLE_GAP_MS);
              // Skip the fresh-job rotation this iteration · we already spent a cycle on the retry
              await sleep(SUPERVISOR_TICK_MS);
              continue;
            } else {
              logIncident("work_item_retry_lease_lost", { workItemId: retry.workItemId, jobSlug: retry.jobSlug, city });
            }
          }
        }
      } catch (e) {
        logIncident("retry_sweep_error", { error: e.message });
      }

      // Iterate jobs serially (Phase 1A: no parallel chains, no city rotation)
      for (const job of jobs) {
        if (signalAborted) break;
        const city = DEFAULT_CITY;

        // Skip if recently cycled
        try {
          if (await recentlyCycled(pool, job, city)) {
            await writeSupervisorHeartbeat(pool, { status: "standby", context: `waiting_for_work · ${job.category_slug}:${city} within cycle_min_gap` });
            continue;
          }
        } catch (e) {
          logIncident("recently_cycled_check_failed", { job: job.category_slug, city, error: e.message });
        }

        // Declare PROCESSING before spawn
        await writeSupervisorHeartbeat(pool, { status: "running", context: `processing:${job.category_slug}:${city}` });

        // ─── Phase 1B.2 · durable work_item lifecycle around the walker cycle ───
        // queued → leased → running → (walker runs) → completed
        // On any DB failure BEFORE spawn: skip this cycle (do NOT run a walker whose
        // durable record can't be created). On DB failure AFTER spawn but before
        // completion: log incident, leave work_item stranded for 1B.3 reclaim.
        let workItemId = null;
        let walkerWorkerId = null;
        try {
          const enq = await workItemEnqueue(pool, {
            jobSlug: job.category_slug, city,
          });
          if (enq.alreadyExists) {
            // Idempotency collision · another attempt for this (job, city, bucket)
            // already exists. Skip this cycle round · natural rate limit.
            logIncident("work_item_idempotency_collision_skip", {
              jobSlug: job.category_slug, city, idempotencyKey: enq.idempotencyKey,
            });
            continue;
          }
          workItemId = enq.workItemId;
          walkerWorkerId = randomUUID();
          await workItemLease(pool, {
            workItemId,
            leaseOwner: `acquisition-supervisor@${process.pid}`,
            walkerWorkerId,
          });
          await workItemMarkRunning(pool, { workItemId });
        } catch (e) {
          logIncident("work_item_prespawn_error", {
            jobSlug: job.category_slug, city, error: e.message,
          });
          // Do NOT spawn a walker whose durable record can't be established.
          continue;
        }

        // Keep-alive: refresh supervisor heartbeat every SUPERVISOR_KEEPALIVE_MS
        // while the child cycle is in flight. Prevents a legitimate long cycle
        // (e.g. restaurants:Yogyakarta at 106s) from appearing "stale" to the
        // watchdog because the main loop is blocked in `await runOneCycle`.
        // Silently records incidents on write failure · never crashes the loop.
        const keepAliveTimer = setInterval(() => {
          writeSupervisorHeartbeat(pool, {
            status: "running",
            context: `processing:${job.category_slug}:${city}`,
          }).catch((e) => logIncident("supervisor_keepalive_heartbeat_error", {
            cycleTag: `${job.category_slug}:${city}`,
            error: e.message,
          }));
        }, SUPERVISOR_KEEPALIVE_MS);

        // Spawn one cycle · wait for exit · clear keep-alive whether success or throw
        const cycleSpawnAt = new Date();
        let outcome;
        try {
          outcome = await runOneCycle(pool, job, city);
        } finally {
          clearInterval(keepAliveTimer);
        }

        // ─── Phase 1B.2 · completion path (happy) + Phase 1B.3 · failure state machine ───
        // code=0 & !killed → completed
        // otherwise → workItemRecordFailure() → retrying (bounded backoff) OR dead_letter (attempts exhausted)
        if (outcome && outcome.exitCode === 0 && !outcome.killed) {
          try {
            const cycleRun = await fetchWalkerCycleRun(pool, {
              jobSlug: job.category_slug, city, sinceIso: cycleSpawnAt.toISOString(),
            });
            await workItemComplete(pool, { workItemId, cycleRun });
          } catch (e) {
            logIncident("work_item_completion_error", {
              workItemId, jobSlug: job.category_slug, city, error: e.message,
            });
            // completion UPDATE itself failed · surface loudly · row remains 'running' · 1B.4 reclaim will handle
          }
        } else {
          // 1B.3 · record failure · same work_item · attempt_count++ · retrying or dead_letter
          const classified = classifyOutcome(outcome);
          try {
            const result = await workItemRecordFailure(pool, {
              workItemId,
              errorClass: classified.class,
              errorMessage: classified.message,
            });
            logIncident("work_item_failure_recorded", {
              workItemId, jobSlug: job.category_slug, city,
              errorClass: classified.class,
              attemptCount: result.attemptCount, maxAttempts: result.maxAttempts,
              newStatus: result.newStatus, nextRetryAt: result.nextRetryAt,
            });
          } catch (e) {
            logIncident("work_item_failure_record_error", {
              workItemId, jobSlug: job.category_slug, city, error: e.message,
              intendedClass: classified.class, intendedMessage: classified.message,
            });
            // failure-record UPDATE itself failed · surface loudly · row remains 'running' · 1B.4 reclaim will handle
          }
        }

        // Polite floor between cycles
        if (CYCLE_GAP_MS > 0 && !signalAborted) await sleep(CYCLE_GAP_MS);
      }

      // End of jobs round · heartbeat again (may declare standby if all cycled recently)
      await writeSupervisorHeartbeat(pool, { status: "standby", context: "round_complete" });
    } catch (e) {
      // NEVER let the loop crash · log and continue (mirrors supervisor.ts:200-210 in System A)
      console.error(`[supervisor] tick error: ${e.message}`);
      logIncident("supervisor_tick_error", { error: e.message, stack: e.stack });
      try { await writeSupervisorHeartbeat(pool, { status: "failed", context: `tick_error: ${e.message.slice(0, 200)}` }); }
      catch { /* even the failure heartbeat can fail · don't kill the loop */ }
    }

    if (signalAborted) break;
    await sleep(SUPERVISOR_TICK_MS);
  }

  // Graceful shutdown heartbeat
  try { await writeSupervisorHeartbeat(pool, { status: "stopped", context: "graceful_shutdown" }); }
  catch { /* best effort */ }
  await pool.end();
  console.log(`\n[supervisor] shutdown complete`);
  process.exit(0);
})();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Disk-space safety guard · Philip 2026-09-03 ─────────────────────
// After the 2026-09-02 incident (C: fell to 100 MB free · Postgres
// began throwing "No space left on device" · supervisor spun on
// tick_error until it died), the workforce must never let itself
// cascade a low-disk condition into a system-wide failure.
//
// On every tick BEFORE any DB work: check free space on the repo
// drive. If below MIN_FREE_DISK_GB, log an incident, mark the
// supervisor "paused · disk_low" in the heartbeat, and back off to a
// long sleep. The workforce resumes automatically once disk is freed.
const MIN_FREE_DISK_GB = Number(process.env.NEX_MIN_FREE_DISK_GB ?? 2);
async function getFreeDiskGB() {
  try {
    const s = await statfs(repoRoot);
    // bavail = blocks available to unprivileged users · bsize = block size
    return (Number(s.bavail) * Number(s.bsize)) / (1024 ** 3);
  } catch {
    return null;   // couldn't determine · fail-open (don't block work)
  }
}
