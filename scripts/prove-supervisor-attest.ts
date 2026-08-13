// scripts/prove-supervisor-attest.ts
//
// Wave 2 · Phase 6 · LIVE VERIFICATION · Path A end-to-end against local NEX Postgres.
// POST-INCIDENT VERSION (2026-08-10) · uses probe_mode + only_kjids safety boundary.
//
// SAFETY ARCHITECTURE
//   1. Creates burner via createJob() — captures the UUID **returned** (not the one
//      we invented). createJob generates its own UUID and ignores input.job_id.
//   2. Calls runSupervisorSweep with `probe_mode: true, only_kjids: [burnerUuid]`.
//      The supervisor's guard throws if the allow-list is missing or empty.
//   3. Asserts before AND after: every one of the 10 preserved fixture kjids
//      still shows `status='claimed', progress=0, completion_result=NULL`.
//   4. Cleanup uses the RETURNED uuid, not the caller-invented placeholder.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-supervisor-attest.ts
//
// EXIT CODES · 0 PASS · 2 FAIL · 1 runner exception

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { getJob, updateJob, listJobs, createJob } from "@/lib/nex/jobs/fs-store";
// Direct-adapter · probe seeds worker_jobs on local NEX Postgres, so the
// supervisor MUST use PostgresBrainStore to read them back. brainStore() would
// return SupabaseStore under current NEX_BRAIN_BACKEND=supabase and look on
// the wrong side. This matches the Wave 5 flip target (post-flip brainStore()
// returns PostgresBrainStore anyway).
import { PostgresBrainStore } from "@/lib/nex/brain/adapters/postgres";
import { runSupervisorSweep } from "@/lib/nex/jobs/supervisor";

const PRESERVED_KJIDS = [
  "46a8eb51-617c-404b-8237-6a515ad6125a",
  "56e1da78-6a97-461a-bc38-cc505d25e00a",
  "ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
  "47e0cf43-5e4c-4d69-a509-59e232e141f1",
  "7fc668ef-cbbc-42a4-b2ef-16e1cde41680",
  "270865e6-f2ca-4fc0-8648-151417c85f64",
  "b1772902-7348-49cd-aed4-48d221ea2d69",
  "1e09c119-f9ed-4400-9dc7-722fc7ae223d",
  "6381641c-eb29-4007-8f3c-2942933cb62d",
  "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
];

const pgUrl = process.env.NEX_POSTGRES_URL;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new Pool({ connectionString: pgUrl, max: 2 });

const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const prefix = `super-burner-${stamp}`;

async function snapshotPreserved(): Promise<Map<string, { status: string; progress: number; completion_result: unknown }>> {
  const q = await pool.query(
    `SELECT job_id, status, progress, completion_result FROM nex.knowledge_dump_jobs WHERE job_id = ANY($1::text[])`,
    [PRESERVED_KJIDS],
  );
  const m = new Map<string, { status: string; progress: number; completion_result: unknown }>();
  for (const r of q.rows) m.set(String(r.job_id), { status: r.status, progress: Number(r.progress), completion_result: r.completion_result });
  return m;
}

function preservedDiff(before: Awaited<ReturnType<typeof snapshotPreserved>>, after: Awaited<ReturnType<typeof snapshotPreserved>>): string[] {
  const diffs: string[] = [];
  for (const [kjid, b] of before.entries()) {
    const a = after.get(kjid);
    if (!a) { diffs.push(`${kjid}: MISSING post-run`); continue; }
    if (a.status !== b.status) diffs.push(`${kjid}: status ${b.status} → ${a.status}`);
    if (Number(a.progress) !== Number(b.progress)) diffs.push(`${kjid}: progress ${b.progress} → ${a.progress}`);
    if (JSON.stringify(a.completion_result) !== JSON.stringify(b.completion_result)) {
      diffs.push(`${kjid}: completion_result changed`);
    }
  }
  return diffs;
}

async function main(): Promise<void> {
  const store = new PostgresBrainStore();

  const pre = await snapshotPreserved();
  if (pre.size !== 10) throw new Error(`pre-flight · expected 10 preserved rows · got ${pre.size}`);
  for (const [kjid, s] of pre.entries()) {
    if (s.status !== "claimed" || Number(s.progress) !== 0 || s.completion_result !== null) {
      throw new Error(`pre-flight · preserved ${kjid} not in restored state · status=${s.status} progress=${s.progress}`);
    }
  }
  console.log("pre-flight · all 10 preserved fixtures in restored state (claimed/0/null)");

  const burnerInboxItemId = `${prefix}-inbox`;
  const created = await createJob({
    inbox_item_id: burnerInboxItemId,
    title: `super-burner attest ${stamp}`,
    source: "burner-probe",
    knowledge_type: null,
    owner: "prove-supervisor-attest",
  });
  if (!created) throw new Error("createJob returned null");
  const burnerUuid = created.job_id;
  console.log(`burner uuid (returned by createJob): ${burnerUuid}`);
  console.log(`burner inbox_item_id: ${burnerInboxItemId}`);

  if (PRESERVED_KJIDS.includes(burnerUuid)) {
    throw new Error(`SAFETY VIOLATION · burner uuid collides with preserved kjid · aborting`);
  }

  const workerJobId = randomUUID();
  const resultId    = randomUUID();

  try {
    // Poll-until-visible · BEFORE calling updateJob({status:"claimed"}).
    //
    // Why here (not after updateJob):
    //   updateJob's first step is `await getJob(burnerUuid)` which, with
    //   NEX_INBOX_READ_BACKEND=postgres, reads from PG. If createJob's
    //   fire-and-forget shadow-write hasn't landed yet, getJob returns null
    //   (see fs-store.ts::getJob line 331 · `pg?.found === false ? null : pg`).
    //   updateJob then returns null without writing anything · the "claimed"
    //   shadow write never fires · the burner stays 'queued' in PG forever
    //   and the sweep can never see it as stuck-claimed.
    //   H3's addition of two SET LOCAL round-trips to withBrainRole widened
    //   the race window that used to be masked by the 300 ms wait.
    const pollDeadlineMs = Date.now() + 15_000;
    let shadowReady = false;
    let pollAttempts = 0;
    while (Date.now() < pollDeadlineMs) {
      pollAttempts += 1;
      const r = await pool.query(
        `SELECT 1 AS ok FROM nex.knowledge_dump_jobs WHERE job_id = $1`,
        [burnerUuid],
      );
      if (r.rowCount && r.rowCount > 0) { shadowReady = true; break; }
      await new Promise((res) => setTimeout(res, 50));
    }
    if (!shadowReady) throw new Error(`createJob shadow-write for burner ${burnerUuid} did not become visible within 15 s (attempts=${pollAttempts})`);
    console.log(`createJob shadow visible after ${pollAttempts} poll(s) · proceeding to claim + backdate`);

    // Now updateJob's initial getJob will find the row in PG · claim succeeds
    // and its own shadow-write fires. Poll again for status=claimed before
    // backdating, so the backdate is always the last write touching updated_at.
    await updateJob(burnerUuid, { status: "claimed" });
    const claimDeadlineMs = Date.now() + 15_000;
    let claimReady = false;
    let claimAttempts = 0;
    while (Date.now() < claimDeadlineMs) {
      claimAttempts += 1;
      const r = await pool.query(
        `SELECT status FROM nex.knowledge_dump_jobs WHERE job_id = $1`,
        [burnerUuid],
      );
      if (r.rows[0] && String((r.rows[0] as { status: string }).status) === "claimed") {
        claimReady = true;
        break;
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    if (!claimReady) throw new Error(`updateJob claimed-shadow for burner ${burnerUuid} did not become visible within 15 s (attempts=${claimAttempts})`);
    console.log(`claimed-shadow visible after ${claimAttempts} poll(s) · proceeding to backdate`);
    const stuckIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await pool.query(`UPDATE nex.knowledge_dump_jobs SET updated_at = $1 WHERE job_id = $2`, [stuckIso, burnerUuid]);
    await pool.query(
      `INSERT INTO nex.worker_jobs (id, worker_type, status, priority, input_kind, input_ref, input_payload, result_id, attempts, created_at, updated_at, completed_at)
       VALUES ($1, 'knowledge-extractor', 'completed', 5, 'inbox_item', $2, '{}'::jsonb, $3, 1, NOW(), NOW(), NOW())`,
      [workerJobId, burnerInboxItemId, resultId],
    );
    await pool.query(
      `INSERT INTO nex.worker_results (id, job_id, worker_type, worker_id, output_kind, output_payload, overall_confidence, flags, created_at)
       VALUES ($1, $2, 'knowledge-extractor', 'burner-probe', 'record_draft', $3::jsonb, 0.9, ARRAY[]::text[], NOW())`,
      [resultId, workerJobId, JSON.stringify({ draft_record_ids: [`${prefix}-draft`] })],
    );

    // Non-zero minimum · detector's readStuckDetectorConfig falls back to 30
    // when the value is <= 0. Set to 1 minute so the 60-min-backdated burner qualifies.
    process.env.NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN = "1";

    console.log(`sweep call · probe_mode=true only_kjids=[${burnerUuid}]`);
    const result = await runSupervisorSweep(store, { getJob, updateJob, listJobs }, {
      batch_id: `probe-attest-${stamp}`,
      probe_mode: true,
      only_kjids: [burnerUuid],
    });
    console.log("sweep result:", JSON.stringify(result));

    if (!result.attested.includes(burnerUuid)) {
      console.error(`FAIL · sweep did not attest burner · attested=${JSON.stringify(result.attested)} · errors=${JSON.stringify(result.errors)}`);
      process.exitCode = 2;
      return;
    }
    for (const attested of result.attested) {
      if (attested !== burnerUuid) {
        console.error(`FAIL · non-burner kjid attested · ${attested}`);
        process.exitCode = 2;
        return;
      }
    }
    const post = await getJob(burnerUuid);
    if (!post || post.status !== "completed") {
      console.error(`FAIL · burner KJ not completed · status=${post?.status}`);
      process.exitCode = 2;
      return;
    }
    console.log(`step 4 · burner KJ terminal · status=${post.status}`);

    const second = await runSupervisorSweep(store, { getJob, updateJob, listJobs }, {
      batch_id: `probe-attest-${stamp}-2`,
      probe_mode: true,
      only_kjids: [burnerUuid],
    });
    if (second.attested.includes(burnerUuid)) {
      console.error("FAIL · second sweep re-attested burner (idempotency broken)");
      process.exitCode = 2;
      return;
    }
    console.log("step 5 · second sweep is no-op for burner (idempotent)");

    const post_preserved = await snapshotPreserved();
    const diffs = preservedDiff(pre, post_preserved);
    if (diffs.length > 0) {
      console.error("FATAL PRESERVATION VIOLATION · preserved fixtures changed during probe:");
      diffs.forEach((d) => console.error("  · " + d));
      console.error("STOP · do not attempt reversal · report incident");
      process.exitCode = 2;
      return;
    }
    console.log("post-flight · all 10 preserved fixtures unchanged (verified diff)");

    console.log("PASS · Path A live · burner attested · preserved fixtures untouched · idempotent");
    process.exitCode = 0;
  } catch (e) {
    console.error("exception:", e instanceof Error ? e.message : String(e));
    process.exitCode = 2;
  } finally {
    try {
      await pool.query(`DELETE FROM nex.worker_results WHERE id = $1`, [resultId]);
      await pool.query(`DELETE FROM nex.worker_jobs WHERE id = $1`, [workerJobId]);
      await pool.query(`DELETE FROM nex.knowledge_dump_jobs WHERE job_id = $1`, [burnerUuid]);
      console.log(`cleanup · burner rows deleted (uuid=${burnerUuid})`);
    } catch (e) {
      console.warn("cleanup pg failed:", (e as Error).message);
    }
    console.log(`cleanup NOTE · fs-store jobs.jsonl retains snapshots for burner ${burnerUuid} (append-only)`);
    await pool.end();
  }
}

main().catch((e) => {
  process.stderr.write(`prove-supervisor-attest · runner exception:\n${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  try { void pool.end(); } catch { /* swallow */ }
  process.exit(1);
});
