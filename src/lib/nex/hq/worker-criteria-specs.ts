// NEX HQ · Six-Criteria Specs per worker type · Task #72 Step 3
//
// Each spec answers 4 of the 6 criteria for a given worker type:
//   · input     · what queue this worker consumes from · SQL to count pending
//   · consumed  · what proves the worker actually took input
//   · output    · what proves output was created
//   · state     · what proves the source state was advanced
// (heartbeat and provable are handled generically in worker-criteria.ts)
//
// Specs are pure data + SQL. No LLM. Every SQL string is exposed on the
// UI as evidence for click-through inspection. If a spec cannot answer a
// criterion because its dependency isn't built yet (e.g. CLE consumer),
// it explicitly returns `markedBlocked: true` so the verdict resolver
// classifies the worker as BLOCKED · never NOT_RUNNING · never PARTIAL.

import type { Pool } from "pg";
import type { CriterionResult, EvidenceRow, WorkerRef } from "./worker-criteria";

export interface SpecEvaluationResult {
  input: CriterionResult;
  consumed: CriterionResult;
  output: CriterionResult;
  state: CriterionResult;
  markedBlocked?: boolean; // If true, verdict resolver escalates to BLOCKED
  markedStandby?: boolean; // Bundle B 2026-08-22 · If true, verdict resolver returns STANDBY (demand-driven worker with no demand)
}

// ── Row-to-evidence mapping helpers ────────────────────────────────────

function summariseRow(row: Record<string, unknown>): EvidenceRow {
  const id = String(
    row.id ?? row.worker_id ?? row.public_ref ?? row.public_listing_ref
    ?? row.internal_id ?? row.job_id ?? row.pk
    ?? Object.values(row)[0] ?? ""
  );
  const summary = Object.entries(row)
    .filter(([k]) => k !== "id" && k !== "pk" && k !== "internal_id" && k !== "public_listing_ref")
    .slice(0, 4)
    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : v}`)
    .join(" · ");
  const tsField = row.last_heartbeat_at ?? row.last_verified_at ?? row.finished_at ?? row.started_at ?? row.created_at;
  return {
    id,
    label: summary || id,
    timestamp: tsField instanceof Date ? tsField.toISOString() : (tsField ? String(tsField) : null),
  };
}

async function runCountAndSample(
  pool: Pool,
  key: CriterionResult["key"],
  sql: string,
  params: unknown[],
  description: string,
  passIfCount: (n: number) => boolean,
  reasonBuilder: (n: number, passed: boolean) => string,
): Promise<CriterionResult> {
  try {
    const r = await pool.query(sql, params);
    const rows = r.rows;
    const count = rows.length;
    const passed = passIfCount(count);
    return {
      key, passed, count,
      evidence: rows.slice(0, 10).map(summariseRow),
      sql,
      description,
      reason: reasonBuilder(count, passed),
    };
  } catch (err) {
    return {
      key, passed: false, count: 0, evidence: [], sql,
      description,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Spec · acquisition:food:* ──────────────────────────────────────────
//
// Input:    food_business rows awaiting (re-)verification (last_verified_at null OR older than freshness)
// Consumed: worker_cycle_run rows for this worker in last 24h with records_processed > 0
// Output:   food_business rows created OR updated within last cycle's window
// State:    food_business rows whose last_verified_at moved forward during last cycle's window

async function evaluateAcquisitionFood(pool: Pool, worker: WorkerRef): Promise<SpecEvaluationResult> {
  // Find the most recent cycle for this worker — evidence window for output/state
  const latestCycle = await pool.query(
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
      ORDER BY started_at DESC LIMIT 1`,
    [worker.worker_id]
  );
  const cycle = latestCycle.rows[0];

  const input = await runCountAndSample(
    pool, "input",
    `SELECT public_listing_ref, source, last_verified_at, created_at
       FROM nex.food_business
      WHERE last_verified_at IS NULL
         OR last_verified_at < now() - interval '7 days'
      ORDER BY (last_verified_at IS NULL) DESC, last_verified_at ASC NULLS FIRST
      LIMIT 10`,
    [],
    "Food businesses awaiting verification (last_verified_at NULL or older than 7 days)",
    (n) => n > 0,
    (n, p) => p
      ? `${n} businesses need (re-)verification · real input exists`
      : "Every food business has been verified within the last 7 days · no work pending",
  );

  const consumed = await runCountAndSample(
    pool, "consumed",
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
        AND started_at > now() - interval '24 hours'
        AND records_processed > 0
      ORDER BY started_at DESC`,
    [worker.worker_id],
    "Worker cycles in last 24h with records_processed > 0 · proves consumption",
    (n) => n > 0,
    (n, p) => p
      ? `${n} cycle${n === 1 ? "" : "s"} in last 24h processed real records`
      : "Zero cycles in last 24h touched any records · consumption not observed",
  );

  // Task #74 · Direct-Provenance A (2026-08-22):
  // Output + State criteria now derive from a DIRECT FK link
  // (food_business_field_provenance.cycle_run_id → worker_cycle_run.id)
  // instead of time-window intersection. Walker stamps the active cycle
  // onto every provenance row it writes; the evaluator queries by that
  // exact cycle id. Provable causality · not inferred correlation.
  const output = cycle
    ? await runCountAndSample(
        pool, "output",
        `SELECT DISTINCT fb.public_listing_ref, fb.source, fb.created_at, fb.last_verified_at
           FROM nex.food_business fb
           JOIN nex.food_business_field_provenance p
                ON p.business_ref = fb.public_listing_ref
          WHERE p.cycle_run_id = $1
          ORDER BY fb.created_at DESC
          LIMIT 10`,
        [cycle.id],
        "food_business rows carrying a provenance row directly linked to this cycle_run_id (Task #74 · direct causality, not time-window inference)",
        (n) => n > 0,
        (n, p) => p
          ? `${n} food_business row${n === 1 ? "" : "s"} carry provenance directly written by this cycle`
          : "Last cycle wrote zero provenance rows · no direct output evidence",
      )
    : {
        key: "output" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to link against",
        description: "Requires a completed worker_cycle_run to check direct-provenance evidence",
        reason: "No worker_cycle_run exists yet · cannot check output",
      };

  // State advanced = at least one row written by this cycle now has last_verified_at set.
  // The Freshness Doctrine says last_verified_at advances only with credible new evidence,
  // so a cycle can PASS output (wrote provenance) and still FAIL state (no verification advance).
  // Both being TRUE simultaneously is the honest signal of state advancement.
  const state = cycle
    ? await runCountAndSample(
        pool, "state",
        `SELECT DISTINCT fb.public_listing_ref, fb.source, fb.last_verified_at
           FROM nex.food_business fb
           JOIN nex.food_business_field_provenance p
                ON p.business_ref = fb.public_listing_ref
          WHERE p.cycle_run_id = $1
            AND fb.last_verified_at IS NOT NULL
          ORDER BY fb.last_verified_at DESC
          LIMIT 10`,
        [cycle.id],
        "food_business rows written by this cycle AND carrying last_verified_at (Task #74 · direct causality + freshness-doctrine advance)",
        (n) => n > 0,
        (n, p) => p
          ? `${n} row${n === 1 ? "" : "s"} written by this cycle carry last_verified_at · state advanced`
          : "Cycle wrote zero rows OR none of the rows it wrote carry last_verified_at · state not advanced",
      )
    : {
        key: "state" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to link against",
        description: "Requires a completed worker_cycle_run to check direct-provenance evidence",
        reason: "No worker_cycle_run exists yet · cannot check state advancement",
      };

  return { input, consumed, output, state };
}

// ── Spec · cle:* (Conversation Learning Engine · Task #76 Bundle B 2026-08-22)
//
// The CLE worker consumes unprocessed conv_turns · generates candidates ·
// persists them at status='pending_review' in nex.conv_learning_candidate
// with cycle_run_id FK from birth. Direct provenance from day one · admin
// promotion required · never auto-teaches.
//
// Six-criteria for CLE:
//   · input: COUNT(conv_turns) WHERE cle_processed_at IS NULL AND speaker='customer'
//   · consumed: cycle_run rows with records_processed > 0 in last 24h
//   · output: COUNT(conv_learning_candidate) WHERE cycle_run_id = latest_cycle
//   · state: COUNT(conv_turns) WHERE cle_cycle_run_id = latest_cycle
//     (turns advanced from queue → processed under this cycle · direct FK proof)
//   · heartbeat + provable: standard
//
// Fresh heartbeat alone MUST NEVER make CLE GREEN. If no candidates
// persisted (dry-run or scoring floor not cleared) · output/state fail ·
// verdict falls to STUCK or PARTIAL. Honest.

async function evaluateCleConversation(pool: Pool, worker: WorkerRef): Promise<SpecEvaluationResult> {
  // Latest cycle for this worker · defines the direct-provenance window
  const latestCycle = await pool.query(
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
      ORDER BY started_at DESC LIMIT 1`,
    [worker.worker_id],
  );
  const cycle = latestCycle.rows[0];

  const input = await runCountAndSample(
    pool, "input",
    `SELECT id, conversation_id, turn_index, speaker, LEFT(text, 60) AS text_preview, created_at
       FROM nex.conv_turns
      WHERE cle_processed_at IS NULL
        AND speaker = 'customer'
        AND created_at > now() - interval '30 days'
      ORDER BY created_at ASC
      LIMIT 10`,
    [],
    "customer conv_turns awaiting CLE consumption (cle_processed_at IS NULL · within last 30 days)",
    (n) => n > 0,
    (n, p) => p
      ? `${n} customer turn${n === 1 ? "" : "s"} in the CLE queue`
      : "CLE queue empty · every customer turn has been processed or none in window",
  );

  const consumed = await runCountAndSample(
    pool, "consumed",
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
        AND started_at > now() - interval '24 hours'
        AND records_processed > 0
      ORDER BY started_at DESC`,
    [worker.worker_id],
    "CLE worker cycles in last 24h with records_processed > 0 · proves real consumption",
    (n) => n > 0,
    (n, p) => p
      ? `${n} CLE cycle${n === 1 ? "" : "s"} in last 24h processed real records`
      : "Zero CLE cycles in last 24h touched any records · consumption not observed",
  );

  const output = cycle
    ? await runCountAndSample(
        pool, "output",
        `SELECT candidate_id, language, brain, candidate_kind, score, status, created_at
           FROM nex.conv_learning_candidate
          WHERE cycle_run_id = $1
          ORDER BY created_at DESC
          LIMIT 10`,
        [cycle.id],
        "candidates written by THIS cycle · direct FK causality · not time-window inference",
        (n) => n > 0,
        (n, p) => p
          ? `${n} candidate${n === 1 ? "" : "s"} persisted under this cycle_run_id`
          : "Cycle wrote zero candidates · no direct output evidence (dry-run or nothing to propose)",
      )
    : {
        key: "output" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to link against",
        description: "Requires a completed CLE worker_cycle_run to check direct-provenance output",
        reason: "No CLE cycle_run exists yet · cannot check output",
      };

  const state = cycle
    ? await runCountAndSample(
        pool, "state",
        `SELECT id, conversation_id, turn_index, speaker, LEFT(text, 60) AS text_preview, cle_processed_at
           FROM nex.conv_turns
          WHERE cle_cycle_run_id = $1
          ORDER BY cle_processed_at DESC
          LIMIT 10`,
        [cycle.id],
        "conv_turns advanced from queue → processed by THIS cycle · direct FK proof of state advancement",
        (n) => n > 0,
        (n, p) => p
          ? `${n} turn${n === 1 ? "" : "s"} moved from pending → processed under this cycle`
          : "This cycle marked zero turns processed · state did not advance under this cycle",
      )
    : {
        key: "state" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to link against",
        description: "Requires a completed CLE worker_cycle_run to check direct-provenance state",
        reason: "No CLE cycle_run exists yet · cannot check state advancement",
      };

  return { input, consumed, output, state };
}

// ── Spec · brain:* (Brain workers · not yet run in this environment) ──
//
// Brain workers exist as code but have never registered a heartbeat or
// executed a cycle in this environment (verified by 2026-08-22 audit).
// The generic default spec correctly classifies them as NOT_RUNNING via
// the ctx.hasEverRun check.

async function evaluateGenericDefault(pool: Pool, worker: WorkerRef): Promise<SpecEvaluationResult> {
  const noSpecReason = `No dedicated spec for worker_type='${worker.worker_type}' · falling back to cycle_run/heartbeat only`;
  const input: CriterionResult = {
    key: "input", passed: false, count: 0, evidence: [],
    sql: "n/a · no input queue mapping for this worker_type",
    description: "This worker type has no declared input queue in worker-criteria-specs",
    reason: noSpecReason,
  };
  const consumed = await runCountAndSample(
    pool, "consumed",
    `SELECT id, started_at, finished_at, records_processed, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1 AND started_at > now() - interval '24 hours' AND records_processed > 0
      ORDER BY started_at DESC`,
    [worker.worker_id],
    "Any cycle in last 24h with records_processed > 0",
    (n) => n > 0,
    (n) => n > 0 ? `${n} cycle${n === 1 ? "" : "s"} touched real records` : "No consumption observed",
  );
  const output: CriterionResult = {
    key: "output", passed: false, count: 0, evidence: [],
    sql: "n/a · no output mapping for this worker_type",
    description: "This worker type has no declared output surface in worker-criteria-specs",
    reason: noSpecReason,
  };
  const state: CriterionResult = { ...output, key: "state" };
  return { input, consumed, output, state };
}

// ── Spec · intake:image (Image Intake worker · Task #77 Bundle C 2026-08-22)
//
// Image Intake is demand-driven · no persistent DB queue between submission
// and consumption. Input arrives via /api/nex-intake/batch (external POST) ·
// worker fires once per batch · writes knowledge_inbox rows at status='review'
// for admin promotion. This is the same never-auto-teach discipline as CLE:
// intake writes CANDIDATES (kind='image' · status='review') · never
// authoritative knowledge_records.
//
// Six-criteria:
//   · input     · a batch was submitted (cycle_run.records_processed >= 0 in last 24h)
//   · consumed  · at least one item in a batch was successfully processed (records_processed > 0)
//   · output    · knowledge_inbox rows created within cycle window (kind='image' · time-window OK for MVP)
//   · state     · those rows have status='review' (advanced from external → observable admin queue)
//   · heartbeat · standard
//   · provable  · standard

async function evaluateIntakeImage(pool: Pool, worker: WorkerRef): Promise<SpecEvaluationResult> {
  const latestCycle = await pool.query(
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
      ORDER BY started_at DESC LIMIT 1`,
    [worker.worker_id],
  );
  const cycle = latestCycle.rows[0];

  // Input · any cycle in last 24h (batch was submitted · demand-driven).
  // Empty-batch invocations count as "input asked" even if records_processed=0.
  const input = await runCountAndSample(
    pool, "input",
    `SELECT id, started_at, records_processed, job_id_external
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
        AND started_at > now() - interval '24 hours'
      ORDER BY started_at DESC LIMIT 10`,
    [worker.worker_id],
    "Image Intake batches submitted in last 24h (external demand-driven · no persistent queue)",
    (n) => n > 0,
    (n, p) => p
      ? `${n} batch${n === 1 ? "" : "es"} submitted in last 24h · Image Intake input demand exists`
      : "Zero batches submitted in last 24h · Image Intake is idle · no demand",
  );

  const consumed = await runCountAndSample(
    pool, "consumed",
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
        AND started_at > now() - interval '24 hours'
        AND records_processed > 0
      ORDER BY started_at DESC LIMIT 10`,
    [worker.worker_id],
    "Image Intake cycles in last 24h with records_processed > 0 · real image consumption",
    (n) => n > 0,
    (n, p) => p
      ? `${n} cycle${n === 1 ? "" : "s"} in last 24h processed real image items`
      : "No cycle actually processed images (may have been empty batches or all duplicates)",
  );

  const output = cycle
    ? await runCountAndSample(
        pool, "output",
        `SELECT id, kind, status, LEFT(title, 60) AS title_preview, to_timestamp(created_at_ms/1000) AS created
           FROM nex.knowledge_inbox
          WHERE kind = 'image'
            AND created_at_ms BETWEEN (EXTRACT(EPOCH FROM $1::timestamptz) * 1000)::bigint
                                  AND (EXTRACT(EPOCH FROM COALESCE($2::timestamptz, now())) * 1000)::bigint
          ORDER BY created_at_ms DESC LIMIT 10`,
        [cycle.started_at, cycle.finished_at],
        "knowledge_inbox rows (kind='image') created within this cycle's time window · pending direct-provenance FK in a follow-up",
        (n) => n > 0,
        (n, p) => p
          ? `${n} image row${n === 1 ? "" : "s"} created during the last cycle window`
          : "Last cycle produced no knowledge_inbox image rows (empty batch · all duplicates · or cycle was heartbeat-only)",
      )
    : {
        key: "output" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to bracket window",
        description: "Requires a completed cycle_run to define output window",
        reason: "No Image Intake cycle_run exists yet · cannot check output",
      };

  // State · rows advanced to status='review' (external → observable · ready for admin promotion)
  const state = cycle
    ? await runCountAndSample(
        pool, "state",
        `SELECT id, status, kind, to_timestamp(created_at_ms/1000) AS created
           FROM nex.knowledge_inbox
          WHERE kind = 'image'
            AND status = 'review'
            AND created_at_ms BETWEEN (EXTRACT(EPOCH FROM $1::timestamptz) * 1000)::bigint
                                  AND (EXTRACT(EPOCH FROM COALESCE($2::timestamptz, now())) * 1000)::bigint
          ORDER BY created_at_ms DESC LIMIT 10`,
        [cycle.started_at, cycle.finished_at],
        "image rows from this cycle now at status='review' · state advanced from external → admin queue",
        (n) => n > 0,
        (n, p) => p
          ? `${n} image row${n === 1 ? "" : "s"} from this cycle now visible at status='review'`
          : "No image rows from this cycle reached status='review' (cycle produced nothing or rows went to different status)",
      )
    : {
        key: "state" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to bracket window",
        description: "Requires a completed cycle_run to check state advancement",
        reason: "No Image Intake cycle_run exists yet · cannot check state",
      };

  // Bundle B 2026-08-22 · demand-driven STANDBY signal.
  // Image Intake is demand-driven (no persistent queue · admin submits batches
  // via /api/nex-intake/batch). "No batches in the 24h observation window" is
  // NOT failure · it's healthy idle. Signal STANDBY to the verdict resolver so
  // Reception can distinguish quiet-and-correct from actually-broken.
  // Threshold: input.count === 0 · matches the 24h window the input criterion
  // already uses (worker-criteria-specs.ts:369-371).
  const markedStandby = input.count === 0;

  return { input, consumed, output, state, markedStandby };
}

// ── Spec · social:comms (Comms Social publish worker · Task #77 Bundle C 2026-08-22)
//
// Comms Social has a persistent queue in nex.social_scheduled_posts. Worker
// leases posts · runs Phase 3 re-check · writes publish_intents (2-phase
// idempotency) · updates scheduled_post status. HQ six-criteria:
//   · input     · social_scheduled_posts WHERE status='queued' AND run_at <= now()
//   · consumed  · cycle_run with records_processed > 0 in last 24h
//   · output    · social_publish_intents WHERE status='verified_published' AND verified_at in cycle window
//   · state     · social_scheduled_posts WHERE status='published' AND finished_at in cycle window (direct state transition)
//   · heartbeat · standard
//   · provable  · standard

async function evaluateCommsSocial(pool: Pool, worker: WorkerRef): Promise<SpecEvaluationResult> {
  const latestCycle = await pool.query(
    `SELECT id, started_at, finished_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
      ORDER BY started_at DESC LIMIT 1`,
    [worker.worker_id],
  );
  const cycle = latestCycle.rows[0];

  const input = await runCountAndSample(
    pool, "input",
    `SELECT scheduled_id, tenant_id, platform, status, run_at, attempts
       FROM nex.social_scheduled_posts
      WHERE status = 'queued'
        AND run_at <= now()
      ORDER BY run_at ASC LIMIT 10`,
    [],
    "social_scheduled_posts awaiting worker (status='queued' · run_at <= now)",
    (n) => n > 0,
    (n, p) => p
      ? `${n} scheduled post${n === 1 ? "" : "s"} queued and due`
      : "No posts queued and due · Comms Social has no pending work",
  );

  const consumed = await runCountAndSample(
    pool, "consumed",
    `SELECT id, started_at, records_processed, records_new, status
       FROM nex.worker_cycle_run
      WHERE worker_id = $1
        AND started_at > now() - interval '24 hours'
        AND records_processed > 0
      ORDER BY started_at DESC LIMIT 10`,
    [worker.worker_id],
    "Comms Social cycles in last 24h with records_processed > 0",
    (n) => n > 0,
    (n, p) => p
      ? `${n} Comms Social cycle${n === 1 ? "" : "s"} in last 24h processed real posts`
      : "Zero Comms Social cycles touched real posts in last 24h",
  );

  const output = cycle
    ? await runCountAndSample(
        pool, "output",
        `SELECT intent_id, tenant_id, platform, status, provider_post_id, verified_at
           FROM nex.social_publish_intents
          WHERE status = 'verified_published'
            AND verified_at BETWEEN $1::timestamptz - interval '1 second'
                                AND COALESCE($2::timestamptz, now()) + interval '1 second'
          ORDER BY verified_at DESC LIMIT 10`,
        [cycle.started_at, cycle.finished_at],
        "social_publish_intents verified_published within this cycle window · time-window today · direct-provenance FK deferrable",
        (n) => n > 0,
        (n, p) => p
          ? `${n} publish intent${n === 1 ? "" : "s"} verified as published during this cycle`
          : "Last cycle verified zero publishes (no queued work · or all refused/failed)",
      )
    : {
        key: "output" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to bracket window",
        description: "Requires a completed cycle_run to check output window",
        reason: "No Comms Social cycle_run exists yet · cannot check output",
      };

  const state = cycle
    ? await runCountAndSample(
        pool, "state",
        `SELECT scheduled_id, platform, status, finished_at
           FROM nex.social_scheduled_posts
          WHERE status = 'published'
            AND finished_at BETWEEN $1::timestamptz - interval '1 second'
                                AND COALESCE($2::timestamptz, now()) + interval '1 second'
          ORDER BY finished_at DESC LIMIT 10`,
        [cycle.started_at, cycle.finished_at],
        "social_scheduled_posts transitioned to status='published' within this cycle window · state advanced",
        (n) => n > 0,
        (n, p) => p
          ? `${n} scheduled post${n === 1 ? "" : "s"} advanced to status='published' during this cycle`
          : "No scheduled_post state transitions to 'published' in this cycle window",
      )
    : {
        key: "state" as const, passed: false, count: 0, evidence: [],
        sql: "n/a · no cycle to bracket window",
        description: "Requires a completed cycle_run to check state advancement",
        reason: "No Comms Social cycle_run exists yet · cannot check state",
      };

  return { input, consumed, output, state };
}

// ── Router · pick the right spec ───────────────────────────────────────

export async function evaluateSpec(pool: Pool, worker: WorkerRef): Promise<SpecEvaluationResult> {
  if (worker.worker_type === "acquisition" && (worker.worker_config ?? "").startsWith("food")) {
    return evaluateAcquisitionFood(pool, worker);
  }
  if (worker.worker_type === "cle") {
    return evaluateCleConversation(pool, worker);
  }
  if (worker.worker_type === "intake" && worker.worker_config === "image") {
    return evaluateIntakeImage(pool, worker);
  }
  if (worker.worker_type === "social") {
    return evaluateCommsSocial(pool, worker);
  }
  return evaluateGenericDefault(pool, worker);
}
