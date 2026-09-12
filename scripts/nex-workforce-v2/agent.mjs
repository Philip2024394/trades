// NEX Workforce v2 · Slice 1c · Agent Binary
// ─────────────────────────────────────────────────────────────────────────────
// One process = one agent = one active lease at a time.
// No shared state with sibling agents. Crash affects only this agent's lease.
//
// Startup:
//   - Verify NEX_WORKFORCE_URL, generate agent_id (UUIDv7 unless env-provided)
//   - Verify DB connectivity + nex_workforce schema present
//   - Enter claim loop
//
// Claim loop:
//   - SELECT nex_workforce.claim(agent_id)  every pollInterval
//   - NULL → sleep, retry
//   - jsonb → runOneWorkItem
//
// Work loop (per work_item):
//   - Independent heartbeat timer (fires every intervalMs regardless of step)
//   - Resolve step-library by (category_slug, source_slug)
//   - Load cursor from work_item.cursor_json
//   - For each step in plan(cursor):
//       acquire source rate token → execute (with retry) → classify →
//       act on class:
//         ok           → advance cursor via step.newCursor, checkpoint, continue
//         transient    → (handled by retry inside execute)  — if surfaces here, treat like partial
//         rate_limit   → sleep Retry-After · retry
//         partial      → record item error, continue
//         permanent    → record item error, continue
//         lease_lost   → abort loop, do NOT persist
//         catastrophic → break loop, fail_soft, exit 1
//   - When plan is empty → complete(records_new, records_rejected)
//
// SIGTERM: finish current step, checkpoint, fail_soft(reason='shutdown'), exit 0

import pg from "pg";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { Heartbeat } from "./lib/heartbeat.mjs";
import { classify, FailureClass, LeaseLostError } from "./lib/classifier.mjs";
import { runWithRetry, DEFAULT_POLICY } from "./lib/retry.mjs";
import * as StepRegistry from "./lib/step_registry.mjs";
import * as SourceRate from "./lib/sources_rate.mjs";
import { withWorkforceRole } from "./lib/with_workforce_role.mjs";

// UUIDv7 approximation: high-bits time-sorted; low-bits random.
// Node 20+ has crypto.randomUUID (v4). We synthesize a v7-like variant.
function uuidv7() {
  const ms = BigInt(Date.now());
  const rand = randomUUID().replace(/-/g, "");
  const timeHex = ms.toString(16).padStart(12, "0");
  return `${timeHex.slice(0,8)}-${timeHex.slice(8,12)}-7${rand.slice(13,16)}-${rand.slice(16,20)}-${rand.slice(20,32)}`;
}

const noopLogger = () => {};
const stderrLogger = (obj) => {
  try { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n"); } catch {}
};

export async function createAgent({ url, agentId, pollMs, heartbeatMsOverride, logger, poolMax } = {}) {
  const config = {
    url:                url ?? process.env.NEX_WORKFORCE_URL,
    agentId:            agentId ?? process.env.NEX_AGENT_ID ?? uuidv7(),
    pollMs:             pollMs ?? Number(process.env.NEX_AGENT_POLL_MS ?? 1000),
    heartbeatMsOverride: heartbeatMsOverride ?? (process.env.NEX_AGENT_HEARTBEAT_MS ? Number(process.env.NEX_AGENT_HEARTBEAT_MS) : null),
    logger:             logger ?? stderrLogger,
    poolMax:            poolMax ?? 3,
  };
  if (!config.url) throw new Error("NEX_WORKFORCE_URL required");

  const pool = new pg.Pool({ connectionString: config.url, max: config.poolMax, query_timeout: 30_000, statement_timeout: 30_000 });

  // Startup verify: nex_workforce schema must exist + claim() callable
  const check = await pool.query(`SELECT 1 FROM pg_namespace WHERE nspname = 'nex_workforce'`);
  if (check.rowCount === 0) {
    await pool.end();
    throw new Error("nex_workforce schema not present · migration not applied");
  }

  const agent = {
    config, pool,
    log: config.logger,
    // runtime state
    stopping:   false,
    stopReason: null,
    // stats
    itemsClaimed:   0,
    itemsCompleted: 0,
    itemsSoftFail:  0,
    itemsAbort:     0,
  };
  agent.log({ msg: "agent.created", agent_id: config.agentId });
  return agent;
}

export async function destroyAgent(agent) {
  if (agent?.pool) await agent.pool.end().catch(() => {});
}

/**
 * Run ONE claim + one work cycle. Returns { outcome, workItemId?, generation?, reason? }.
 * outcome ∈ { 'idle', 'completed', 'soft_fail', 'lease_lost', 'catastrophic' }
 */
export async function runAgentOnce(agent) {
  const { pool, config } = agent;

  // Claim
  const claimed = await withWorkforceRole(pool, (c) =>
    c.query("SELECT nex_workforce.claim($1) AS row", [config.agentId]));
  const row = claimed.rows[0].row;
  if (row === null) {
    return { outcome: "idle" };
  }
  agent.itemsClaimed++;
  agent.log({ msg: "agent.claimed", work_item_id: row.id, generation: row.generation, city: row.city_slug, category: row.category_slug, source: row.source_slug });

  return runWorkItem(agent, row);
}

async function runWorkItem(agent, workItem) {
  const { pool, config } = agent;
  // Determine heartbeat interval · use override if set, else default from lease_deadline
  // Lease budget in seconds:
  const leaseSecs = Math.max(1, Math.floor((new Date(workItem.lease_deadline).getTime() - Date.now()) / 1000));
  const heartbeatMs = config.heartbeatMsOverride ?? Math.max(200, Math.floor((leaseSecs * 1000) / 4)); // 1/4 lease for safety
  agent.log({ msg: "agent.work.start", work_item_id: workItem.id, lease_secs: leaseSecs, heartbeat_ms: heartbeatMs });

  let leaseLost = false;
  const hb = new Heartbeat({
    pool, agentId: config.agentId, workItemId: workItem.id, generation: workItem.generation,
    intervalMs: heartbeatMs,
    onLoss: (reason) => { leaseLost = true; agent.log({ msg: "agent.heartbeat.lost", reason, work_item_id: workItem.id }); },
    logger: agent.log,
  });
  hb.start();

  const abortCheck = () => { if (leaseLost || hb.isLost()) throw new LeaseLostError(); };

  // Wall-clock step-total deadline (Philip 2026-09-04 correction #3):
  //   STEP TOTAL DEADLINE < LEASE DEADLINE - SAFETY MARGIN
  // Agent enforces the step's total deadline (including retries + backoff +
  // network time). Defaults to half the lease if step doesn't declare a
  // timeoutMs. Heartbeat continues independently of step execution.
  const stepDeadlineMs = (step) => {
    const stepBound = Number.isFinite(step?.timeoutMs) ? step.timeoutMs : Infinity;
    const halfLease  = Math.floor(leaseSecs * 500); // 0.5 × lease in ms
    return Math.min(stepBound, halfLease);
  };

  let stepLib;
  try {
    stepLib = StepRegistry.resolve(workItem.category_slug, workItem.source_slug);
  } catch (err) {
    hb.stop();
    // No step-library → catastrophic (misconfigured deployment)
    agent.log({ msg: "agent.catastrophic", reason: "no step-library", work_item_id: workItem.id, err: err.message });
    await tryFailSoft(agent, workItem, "no step-library registered", "catastrophic", 60);
    agent.itemsSoftFail++;
    return { outcome: "catastrophic", workItemId: workItem.id, reason: err.message };
  }

  let cursor = workItem.cursor_json && Object.keys(workItem.cursor_json).length > 0
    ? workItem.cursor_json
    : (stepLib.seedCursor?.() ?? {});
  let recordsNew = 0, recordsRejected = 0;

  try {
    // Outer loop: re-plan after each successful step (cursor may have advanced)
    while (true) {
      abortCheck();
      const steps = stepLib.plan({ cursor, workItem });
      if (!steps || steps.length === 0) break;
      const step = steps[0]; // execute one at a time so we can checkpoint

      abortCheck();
      await SourceRate.acquire(workItem.source_slug, step.rateOverride ?? null);

      // Retry policy per step
      const policy = step.retryPolicy ?? DEFAULT_POLICY;
      // Step-total deadline · one AbortController spans all retries + backoffs
      // (Philip 2026-09-04 correction #3). Two sources of abort:
      //   1. Heartbeat detects lease loss → onLoss → stepAborter.abort()
      //   2. Step deadline reached      → setTimeout → stepAborter.abort()
      const stepAborter = new AbortController();
      const deadlineMs  = stepDeadlineMs(step);
      const deadlineTimer = Number.isFinite(deadlineMs)
        ? setTimeout(() => { stepAborter.abort(new Error(`step_deadline_exceeded: ${deadlineMs}ms`)); }, deadlineMs)
        : null;
      // Wire heartbeat loss into the step's abort signal
      const originalOnLoss = hb.onLoss;
      hb.onLoss = (reason) => { originalOnLoss?.(reason); try { stepAborter.abort(new LeaseLostError()); } catch {} };

      let stepResult, stepClass = null;
      try {
        stepResult = await runWithRetry(
          async (attempt) => {
            abortCheck();
            if (stepAborter.signal.aborted) throw (stepAborter.signal.reason ?? new Error("aborted"));
            return step.execute({ ctx: { agent, workItem, cursor, attempt, abortSignal: stepAborter.signal, logger: agent.log } });
          },
          policy,
          {
            shouldRetry: (err) => {
              // Never retry once aborted (deadline or lease loss)
              if (stepAborter.signal.aborted) return false;
              const c = classify(err, { customRules: step.classifier ?? [] });
              return c.class === FailureClass.TRANSIENT || c.class === FailureClass.RATE_LIMIT;
            },
            onBackoff: ({ attempt, delayMs, err }) => {
              agent.log({ msg: "agent.step.retry", step_id: step.id, attempt, delay_ms: delayMs, err: err.message });
            },
            signal: stepAborter.signal,
          }
        );
        stepClass = { class: FailureClass.OK };
      } catch (err) {
        stepClass = classify(err, { customRules: step.classifier ?? [] });
        // Aborted-flow classification takes precedence over err-shape classification.
        // (e.g. AbortError from fetch() has err.name='AbortError' which classifier
        //  would call transient · but if we aborted for lease loss, it's lease_lost.)
        if (stepAborter.signal.aborted) {
          const reason = stepAborter.signal.reason;
          if (reason?.__leaseLost || reason?.name === "LeaseLostError") {
            stepClass = { class: FailureClass.LEASE_LOST, reason: "lease lost during step" };
          } else if (reason?.message?.startsWith("step_deadline_exceeded")) {
            stepClass = { class: FailureClass.TRANSIENT_EXHAUSTED, reason: reason.message };
          }
          // Any other abort reason falls through to whatever classify() said
        }
        // Promote surviving TRANSIENT/RATE_LIMIT after retry exhaustion to
        // TRANSIENT_EXHAUSTED (Philip 2026-09-04 correction #1): the outer
        // retry loop gave up; external source misbehaving; NOT catastrophic.
        else if (stepClass.class === FailureClass.TRANSIENT || stepClass.class === FailureClass.RATE_LIMIT) {
          stepClass = { class: FailureClass.TRANSIENT_EXHAUSTED, reason: `${stepClass.class} exhausted after ${policy.maxAttempts} attempts: ${stepClass.reason}` };
        }
        agent.log({ msg: "agent.step.classified", step_id: step.id, class: stepClass.class, reason: stepClass.reason });
      } finally {
        if (deadlineTimer) clearTimeout(deadlineTimer);
      }

      // Act on class
      if (stepClass.class === FailureClass.OK) {
        // Advance cursor via step's newCursor (if provided), else identity
        cursor = step.newCursor ? await step.newCursor({ cursor, result: stepResult }) : cursor;
        abortCheck();
        // CHECKPOINT · persist cursor (this also extends lease)
        const cpOk = (await withWorkforceRole(pool, (c) =>
          c.query("SELECT nex_workforce.checkpoint($1, $2, $3, $4::jsonb) AS ok",
            [config.agentId, workItem.id, workItem.generation, JSON.stringify(cursor)]))).rows[0].ok;
        if (cpOk !== true) {
          agent.log({ msg: "agent.checkpoint.rejected", work_item_id: workItem.id });
          throw new LeaseLostError();
        }
        continue; // proceed to next step
      }

      if (stepClass.class === FailureClass.PARTIAL) {
        recordsRejected++;
        agent.log({ msg: "agent.step.partial", step_id: step.id, reason: stepClass.reason });
        // Advance past the failed item · cursor advance is step-library's job via a partial-handler.
        // For Slice 1c hello-world we simply advance cursor by 1 to prevent infinite loops.
        cursor = step.newCursor ? await step.newCursor({ cursor, result: null }) : cursor;
        await withWorkforceRole(pool, (c) =>
          c.query("SELECT nex_workforce.checkpoint($1, $2, $3, $4::jsonb) AS ok",
            [config.agentId, workItem.id, workItem.generation, JSON.stringify(cursor)]));
        continue;
      }

      if (stepClass.class === FailureClass.PERMANENT) {
        recordsRejected++;
        agent.log({ msg: "agent.step.permanent", step_id: step.id, reason: stepClass.reason });
        cursor = step.newCursor ? await step.newCursor({ cursor, result: null }) : cursor;
        await withWorkforceRole(pool, (c) =>
          c.query("SELECT nex_workforce.checkpoint($1, $2, $3, $4::jsonb) AS ok",
            [config.agentId, workItem.id, workItem.generation, JSON.stringify(cursor)]));
        continue;
      }

      if (stepClass.class === FailureClass.LEASE_LOST) {
        throw new LeaseLostError();
      }

      // Retry-exhausted on transient/rate-limit → fail_soft with bounded backoff
      // (Philip 2026-09-04 correction #1). NEVER fabricate records_rejected
      // for source unavailability. The tuple returns to queue via view/reaper
      // path when soft_fail backoff elapses.
      if (stepClass.class === FailureClass.TRANSIENT_EXHAUSTED) {
        agent.log({ msg: "agent.transient_exhausted", step_id: step.id, reason: stepClass.reason, work_item_id: workItem.id });
        hb.stop();
        // Pass null for p_backoff_seconds → SQL fail_soft uses exponential
        // backoff derived from attempts (15s * 2^attempts, capped at 1h).
        await tryFailSoft(agent, workItem, `transient_exhausted in ${step.id}: ${stepClass.reason}`, "transient_exhausted", null);
        agent.itemsSoftFail++;
        return { outcome: "transient_exhausted", workItemId: workItem.id, reason: stepClass.reason };
      }

      // catastrophic → break out and fail_soft
      agent.log({ msg: "agent.catastrophic", step_id: step.id, reason: stepClass.reason, work_item_id: workItem.id });
      hb.stop();
      await tryFailSoft(agent, workItem, `catastrophic in ${step.id}: ${stepClass.reason}`, "catastrophic", 60);
      agent.itemsSoftFail++;
      return { outcome: "catastrophic", workItemId: workItem.id, reason: stepClass.reason };
    }

    // Plan exhausted · complete
    abortCheck();
    const totals = stepLib.totals ? stepLib.totals({ cursor }) : { records_new: recordsNew, records_rejected: recordsRejected };
    hb.stop();
    const cok = (await withWorkforceRole(pool, (c) =>
      c.query("SELECT nex_workforce.complete($1, $2, $3, $4, $5) AS ok",
        [config.agentId, workItem.id, workItem.generation, totals.records_new ?? 0, totals.records_rejected ?? 0]))).rows[0].ok;
    if (cok !== true) {
      // Lease was lost between last checkpoint and complete
      agent.log({ msg: "agent.complete.rejected", work_item_id: workItem.id });
      agent.itemsAbort++;
      return { outcome: "lease_lost", workItemId: workItem.id, reason: "complete rejected" };
    }
    agent.itemsCompleted++;
    agent.log({ msg: "agent.completed", work_item_id: workItem.id, records_new: totals.records_new, records_rejected: totals.records_rejected });
    return { outcome: "completed", workItemId: workItem.id, generation: workItem.generation };

  } catch (err) {
    hb.stop();
    if (err instanceof LeaseLostError || err?.__leaseLost) {
      agent.log({ msg: "agent.lease_lost.aborted", work_item_id: workItem.id });
      agent.itemsAbort++;
      return { outcome: "lease_lost", workItemId: workItem.id, reason: "lease lost mid-work" };
    }
    // Uncaught → treat as catastrophic, try to soft-fail
    agent.log({ msg: "agent.uncaught", work_item_id: workItem.id, err: err.message, stack: err.stack });
    await tryFailSoft(agent, workItem, `uncaught: ${err.message}`, "catastrophic", 60);
    agent.itemsSoftFail++;
    return { outcome: "catastrophic", workItemId: workItem.id, reason: err.message };
  }
}

async function tryFailSoft(agent, workItem, reason, klass, backoffSec) {
  try {
    const r = await withWorkforceRole(agent.pool, (c) =>
      c.query(
        "SELECT nex_workforce.fail_soft($1, $2, $3, $4, $5, $6) AS ok",
        [agent.config.agentId, workItem.id, workItem.generation, reason, klass, backoffSec]
      ));
    agent.log({ msg: "agent.fail_soft", work_item_id: workItem.id, ok: r.rows[0].ok, reason });
    return r.rows[0].ok === true;
  } catch (e) {
    agent.log({ msg: "agent.fail_soft.err", work_item_id: workItem.id, err: e.message });
    return false;
  }
}

/** Run a continuous claim/work loop until agent.stopping becomes true. */
export async function runAgentLoop(agent) {
  agent.log({ msg: "agent.loop.start", agent_id: agent.config.agentId, poll_ms: agent.config.pollMs });
  while (!agent.stopping) {
    try {
      const r = await runAgentOnce(agent);
      if (r.outcome === "idle") {
        await sleepInterruptible(agent.config.pollMs, () => agent.stopping);
      }
    } catch (err) {
      agent.log({ msg: "agent.loop.err", err: err.message });
      await sleepInterruptible(agent.config.pollMs, () => agent.stopping);
    }
  }
  agent.log({ msg: "agent.loop.stopped", stop_reason: agent.stopReason });
}

function sleepInterruptible(ms, stopFlag) {
  return new Promise((resolve) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (stopFlag() || Date.now() - start >= ms) { clearInterval(t); resolve(); }
    }, Math.min(50, ms));
  });
}

/** Signal the loop to stop after the current cycle. */
export function requestStop(agent, reason) {
  agent.stopping = true;
  agent.stopReason = reason ?? "requested";
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point when invoked directly
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  // Register all production capabilities via the canonical barrel in
  // steps/index.mjs (helloworld + overpass_observe + overpass_observe_and_stage
  // for restaurants/cafes/retail-fashion/retail-books). Tests bypass main()
  // via direct imports of createAgent/runAgentOnce and register their own
  // fixtures with StepRegistry.register().
  //
  // Slice 4 followup (Gate 5A finding · 2026-09-04): previously main() only
  // registered helloworld · real production categories claimed under the CLI
  // agent binary hit "no step-library registered" → catastrophic → fail_soft.
  const { registerAll } = await import("./steps/index.mjs");
  registerAll();

  const agent = await createAgent();
  process.on("SIGTERM", () => { requestStop(agent, "SIGTERM"); });
  process.on("SIGINT",  () => { requestStop(agent, "SIGINT"); });
  await runAgentLoop(agent);
  await destroyAgent(agent);
}

// Windows-safe main-guard · pathToFileURL normalises drive-letter + slash direction
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { stderrLogger({ msg: "agent.main.fatal", err: err.message, stack: err.stack }); process.exit(1); });
}
