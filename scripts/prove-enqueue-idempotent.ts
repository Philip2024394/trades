// scripts/prove-enqueue-idempotent.ts
//
// WAVE 1 · §1.5 · Live probe that PostgresBrainStore.enqueueJob is
// idempotent under the D1 ON CONFLICT clause added tonight.
//
// Contract:
//   1. Two consecutive calls with identical (input_ref, worker_type) while
//      the first row is in an active status ('waiting'|'assigned'|'running')
//      return the SAME WorkerJob row.
//   2. Neither call throws the plan-time "no matching unique constraint"
//      error — which is exactly what would happen if migration 046 had
//      not been applied.
//   3. A third call with a DIFFERENT worker_type creates a NEW row.
//   4. A fourth call for the same (input_ref, worker_type) AFTER the
//      first row is marked completed CREATES a new row (the partial
//      predicate excludes completed rows).
//
// Cleanup: every probe row is deleted on the way out (both pass and fail).
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-enqueue-idempotent.ts
//
// EXIT CODES
//   0 · PASS · all four contract clauses hold
//   2 · FAIL · a clause did not hold (details on stderr)
//   1 · runner exception

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { PostgresBrainStore } from "@/lib/nex/brain/adapters/postgres";
import type { WorkerJob } from "@/lib/nex/brain/types";

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const pool = new Pool({ connectionString: pgUrl, max: 2 });
const ref  = `enq-idem-probe-${Date.now()}-${randomUUID().slice(0, 8)}`;
const store = new PostgresBrainStore();
const createdIds: string[] = [];

function log(msg: string, obj?: unknown): void {
  if (obj !== undefined) console.log(msg, JSON.stringify(obj));
  else console.log(msg);
}

async function main(): Promise<void> {
  log(`probe input_ref: ${ref}`);
  try {
    // ── Clause 1 · Two consecutive calls, same (ref, worker_type)
    const first: WorkerJob = await store.enqueueJob({
      worker_type: "knowledge-context",
      priority: 5,
      input_kind: "inbox_item",
      input_ref: ref,
      input_payload: { probe: "clause-1a" },
    });
    createdIds.push(first.id);
    log("clause 1a · first enqueue id:", first.id);

    const second: WorkerJob = await store.enqueueJob({
      worker_type: "knowledge-context",
      priority: 5,
      input_kind: "inbox_item",
      input_ref: ref,
      input_payload: { probe: "clause-1b" }, // different payload · must be ignored
    });
    log("clause 1b · second enqueue id:", second.id);

    if (second.id !== first.id) {
      console.error(`FAIL clause 1 · expected same id · got first=${first.id} second=${second.id}`);
      process.exitCode = 2;
      return;
    }
    log("PASS clause 1 · same (input_ref, worker_type) returns same row");

    // ── Clause 3 · Different worker_type = new row
    const third: WorkerJob = await store.enqueueJob({
      worker_type: "voice-context",
      priority: 5,
      input_kind: "inbox_item",
      input_ref: ref,
      input_payload: { probe: "clause-3" },
    });
    createdIds.push(third.id);
    if (third.id === first.id) {
      console.error(`FAIL clause 3 · different worker_type collided · got id=${third.id}`);
      process.exitCode = 2;
      return;
    }
    log(`PASS clause 3 · different worker_type creates new row · id: ${third.id}`);

    // ── Clause 4 · After first row is completed, re-enqueue creates new row
    await pool.query(
      `UPDATE nex.worker_jobs SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [first.id],
    );
    log("clause 4 setup · first row marked completed");

    const fourth: WorkerJob = await store.enqueueJob({
      worker_type: "knowledge-context",
      priority: 5,
      input_kind: "inbox_item",
      input_ref: ref,
      input_payload: { probe: "clause-4" },
    });
    createdIds.push(fourth.id);
    if (fourth.id === first.id) {
      console.error(`FAIL clause 4 · re-enqueue after completion returned old row · id=${fourth.id}`);
      process.exitCode = 2;
      return;
    }
    log(`PASS clause 4 · re-enqueue after completion creates new row · id: ${fourth.id}`);

    log("PASS · all four contract clauses hold");
    process.exitCode = 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The specific error we're guarding against — surface it prominently.
    if (/no unique or exclusion constraint/i.test(msg)) {
      console.error("FAIL · migration 046 is NOT applied — ON CONFLICT plan-time error:");
    }
    console.error("exception:", msg);
    process.exitCode = 2;
  } finally {
    if (createdIds.length > 0) {
      try {
        await pool.query(`DELETE FROM nex.worker_jobs WHERE id = ANY($1::uuid[])`, [createdIds]);
        log(`cleanup · ${createdIds.length} probe rows deleted`);
      } catch (e) {
        console.warn("cleanup failed:", (e as Error).message);
      }
    }
    await pool.end();
  }
}

main().catch(async (e) => {
  const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
  process.stderr.write(`prove-enqueue-idempotent · runner exception:\n${msg}\n`);
  try { await pool.end(); } catch { /* swallow */ }
  process.exit(1);
});
