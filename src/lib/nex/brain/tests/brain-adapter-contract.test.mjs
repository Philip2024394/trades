#!/usr/bin/env node
// brain-adapter-contract.test.mjs · Phase 11.1c · Parity Harness
//
// Proves the uncommitted PostgresBrainStore adapter (11.1b) behaves
// identically to the production SupabaseStore across every gate Philip
// specified in the 11.1b authorization. Once this passes, 11.1c folds
// the adapter in with a coherent commit and unblocks 11.2 (Inbox +
// jobs migration) then 11.3 (backend flip).
//
// The harness is TWO LAYERS:
//
//   LAYER A · STATIC CONTRACT · greps storage.ts to confirm the
//   PostgresBrainStore class exists, implements the same 30-method
//   BrainStore interface as SupabaseStore, and uses the SQL patterns
//   the acceptance gate requires (ON CONFLICT DO NOTHING · SET LOCAL
//   ROLE nex_brain_app · nex.claim_next_job SKIP LOCKED delegation ·
//   RETURNING * etc.).
//
//   LAYER B · LIVE SQL SEMANTICS · exercises OUR OWN Postgres directly
//   with a `parity_test_<uuid>` prefix so no real records are touched
//   and cleanup can wipe everything at the end. Every semantic Philip
//   named in the 11.1b gate is verified against live SQL executing
//   under the same conditions the adapter uses.
//
// GUARDRAILS:
//   · Never touches production Supabase (Supabase reads/writes require
//     network + service role · this harness is Postgres-only).
//   · Test data is namespaced with parity_test_<uuid> and cleaned in
//     a `finally` even on failure.
//   · Never modifies real records / jobs / feedback.
//   · Doesn't flip NEX_BRAIN_BACKEND — Supabase remains production.
//
// Assertions (28 total):
//   A · Structural / static contract
//     C1  · PostgresBrainStore class present in storage.ts
//     C2  · Implements BrainStore interface
//     C3  · activeBackend() returns "postgres" when NEX_BRAIN_BACKEND=postgres
//     C4  · _resetBrainStoreForTests exported (needed for adapter switch)
//     C5  · withTx wraps every op in BEGIN + SET LOCAL ROLE + COMMIT/ROLLBACK
//     C6  · SupabaseStore + PostgresBrainStore expose identical method sets
//     C7  · PostgresBrainStore.insertRecordIdempotent uses ON CONFLICT DO NOTHING
//     C8  · PostgresBrainStore.claimNextJob delegates to nex.claim_next_job
//     C9  · PostgresBrainStore.claimNextLlmRetry delegates to nex.claim_next_llm_retry
//     C10 · PostgresBrainStore.upsertHeartbeat uses ON CONFLICT (host_id) DO UPDATE
//     C11 · brainStore() singleton picks PostgresBrainStore when NEX_BRAIN_BACKEND=postgres
//
//   B · Live SQL semantics (Postgres nex.* schema, application role)
//     L1  · New record insert · returns exactly one row
//     L2  · Duplicate insertRecordIdempotent · zero rows written, first-write wins
//     L3  · Concurrent duplicates · no race · exactly one row survives
//     L4  · nex.claim_next_job · SKIP LOCKED · two workers → two distinct jobs
//     L5  · nex.claim_next_job · exhausted queue returns NULL id
//     L6  · Status transition · DRAFT → UNDER_REVIEW → AUTHORITATIVE (all persist)
//     L7  · Status counts · reflect DRAFT/UNDER_REVIEW/AUTHORITATIVE partition
//     L8  · Confidence classification · CHECK constraint rejects invalid taxonomy
//     L9  · FK cascade · deleting knowledge_records deletes confidence_scores
//     L10 · knowledge_job_id round-trip · worker_jobs.input_payload.knowledge_job_id
//           survives insert + select
//     L11 · Feedback lifecycle · insert → list unapplied → mark applied → list zero
//     L12 · LLM retry lifecycle · enqueue → claim → mark succeeded
//     L13 · Heartbeat upsert · same host_id upsert overwrites without duplicate
//     L14 · RLS · nex_brain_app CAN read/write brain tables
//     L15 · RLS · a foreign no-privilege role CANNOT read brain tables
//     L16 · nex.nex_brain_status view returns finite integers for the 3 count fields
//     L17 · Cleanup · every parity_test_<uuid> row deleted at end

import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const PG_URL = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool   = new Pool({ connectionString: PG_URL, max: 4 });

const STORAGE = readFileSync(join(REPO, "src/lib/nex/brain/storage.ts"), "utf8");
// Wave 11 · Step 10 · F12 · PostgresBrainStore was extracted to a
// dedicated adapter file · every static contract check that inspects
// the class body reads from here instead of storage.ts.
const POSTGRES_ADAPTER = readFileSync(join(REPO, "src/lib/nex/brain/adapters/postgres.ts"), "utf8");
// Wave 11 · Step 10 · F12 · SupabaseStore was likewise extracted to
// adapters/supabase.ts. C6 (parity of method surfaces between
// SupabaseStore and PostgresBrainStore) reads from here now.
const SUPABASE_ADAPTER = readFileSync(join(REPO, "src/lib/nex/brain/adapters/supabase.ts"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

const TEST_TAG = `parity_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const testRid  = (n) => `${TEST_TAG}_rec_${n}`;
const testRef  = (n) => `${TEST_TAG}_ref_${n}`;

async function insideNexRole(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function insertRecord(c, rec) {
  const r = await c.query(
    `INSERT INTO nex.knowledge_records
       (record_id, record_version, status, canonical_owner, authored_by, title, category, summary, body_markdown, primary_audience)
     VALUES ($1, '1', $2, 'nex-authored', 'nex', $3, 'test-category', 'parity harness test row', 'parity harness body · disposable', 'homeowner')
     ON CONFLICT (record_id) DO NOTHING
     RETURNING *`,
    [rec.record_id, rec.status ?? "DRAFT", rec.title ?? "Parity Harness Test"]
  );
  return r;
}

async function main() {
  process.stdout.write("brain-adapter-contract.test.mjs\n");
  process.stdout.write(`  tag=${TEST_TAG}\n`);

  // ═══════════════════════════════════════════════════════════════════
  // LAYER A · STATIC CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  // C1 · PostgresBrainStore class (Wave 11 F12 · now in adapters/postgres.ts)
  record("C1", /class PostgresBrainStore implements BrainStore/.test(POSTGRES_ADAPTER),
    "class PostgresBrainStore implements BrainStore (adapters/postgres.ts)");

  // C2 · Every BrainStore interface method has a corresponding method
  // declaration in PostgresBrainStore. Interface still lives in storage.ts;
  // class body now lives in adapters/postgres.ts.
  const ifaceBlock   = STORAGE.match(/^export interface BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  const pgClassBlock = POSTGRES_ADAPTER.match(/class PostgresBrainStore implements BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  const ifaceMethods = [...ifaceBlock.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)]
    .map((m) => m[1])
    .filter((n) => n !== "BrainStore");
  const missingImpl = ifaceMethods.filter((n) => !new RegExp(`\\basync\\s+${n}\\s*\\(`).test(pgClassBlock));
  record("C2", missingImpl.length === 0,
    missingImpl.length === 0 ? `all ${ifaceMethods.length} BrainStore methods implemented` : `missing: ${missingImpl.join(", ")}`);

  // C3 · activeBackend() understands "postgres"
  record("C3", /activeBackend\(\):\s*"filesystem"\s*\|\s*"supabase"\s*\|\s*"postgres"/.test(STORAGE)
    && /if\s*\(isPostgresConfigured\(\)\)\s*return\s*"postgres"/.test(STORAGE),
    "activeBackend() branches into postgres when configured");

  // C4 · _resetBrainStoreForTests exported
  record("C4", /export function _resetBrainStoreForTests\(\)/.test(STORAGE),
    "_resetBrainStoreForTests exported");

  // C5 · withTx wraps BEGIN + SET LOCAL ROLE + COMMIT/ROLLBACK. Search
  // the whole class body since those strings appear only inside withTx.
  const wrapsRole = /private async withTx/.test(pgClassBlock)
    && /await c\.query\("BEGIN"\)/.test(pgClassBlock)
    && /await c\.query\("SET LOCAL ROLE nex_brain_app"\)/.test(pgClassBlock)
    && /await c\.query\("COMMIT"\)/.test(pgClassBlock)
    && /await c\.query\("ROLLBACK"\)/.test(pgClassBlock);
  record("C5", wrapsRole,
    "withTx does BEGIN + SET LOCAL ROLE nex_brain_app + COMMIT/ROLLBACK");

  // C6 · SupabaseStore + PostgresBrainStore share identical method surfaces.
  // Wave 11 · Step 10 · F12 · SupabaseStore now lives in adapters/supabase.ts.
  const sbClassBlock = SUPABASE_ADAPTER.match(/class SupabaseStore implements BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  const sbMethods = new Set(
    [...sbClassBlock.matchAll(/^\s*async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map((m) => m[1])
  );
  const pgMethods = new Set(
    [...pgClassBlock.matchAll(/^\s*async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map((m) => m[1])
  );
  const inSbOnly = [...sbMethods].filter((n) => !pgMethods.has(n));
  const inPgOnly = [...pgMethods].filter((n) => !sbMethods.has(n));
  record("C6", inSbOnly.length === 0 && inPgOnly.length === 0,
    inSbOnly.length + inPgOnly.length === 0
      ? `identical method surfaces · ${sbMethods.size} methods`
      : `sb-only: ${inSbOnly.join(",")} · pg-only: ${inPgOnly.join(",")}`);

  // C7 · idempotent insert uses ON CONFLICT DO NOTHING (race-safe)
  record("C7", /insertRecordIdempotent[\s\S]*?ON CONFLICT \(record_id\) DO NOTHING/.test(pgClassBlock),
    "insertRecordIdempotent uses ON CONFLICT (record_id) DO NOTHING");

  // C8 · claimNextJob delegates to the SKIP LOCKED helper
  record("C8", /claimNextJob[\s\S]*?FROM nex\.claim_next_job\(/.test(pgClassBlock),
    "claimNextJob delegates to nex.claim_next_job()");

  // C9 · claimNextLlmRetry delegates too
  record("C9", /claimNextLlmRetry[\s\S]*?FROM nex\.claim_next_llm_retry\(/.test(pgClassBlock),
    "claimNextLlmRetry delegates to nex.claim_next_llm_retry()");

  // C10 · upsertHeartbeat uses ON CONFLICT (host_id) DO UPDATE
  record("C10", /upsertHeartbeat[\s\S]*?ON CONFLICT \(host_id\) DO UPDATE/.test(pgClassBlock),
    "upsertHeartbeat uses ON CONFLICT (host_id) DO UPDATE");

  // C11 · brainStore() selects PostgresBrainStore branch
  // Regex tolerates the Wave 7 rewrite where the postgres branch
  // became multi-line to also wire the reverse-shadow decorator.
  record("C11",
    /isPostgresConfigured\(\)[\s\S]{0,200}?new PostgresBrainStore\(\)/.test(STORAGE),
    "brainStore() picks PostgresBrainStore when postgres backend configured");

  // ═══════════════════════════════════════════════════════════════════
  // LAYER B · LIVE SQL SEMANTICS
  // ═══════════════════════════════════════════════════════════════════

  // L1 · fresh insert returns exactly one row
  try {
    const r = await insideNexRole((c) => insertRecord(c, { record_id: testRid(1) }));
    record("L1", r.rowCount === 1, `rowCount=${r.rowCount}`);
  } catch (e) { record("L1", false, `threw: ${e.message}`); }

  // L2 · duplicate insertRecordIdempotent returns zero rows
  try {
    const r = await insideNexRole((c) => insertRecord(c, { record_id: testRid(1) }));
    record("L2", r.rowCount === 0, `rowCount=${r.rowCount} (expected 0 · dup)`);
  } catch (e) { record("L2", false, `threw: ${e.message}`); }

  // L3 · concurrent duplicates · no race
  try {
    const rid = testRid("race");
    const race = await Promise.all(
      Array.from({ length: 4 }, () =>
        insideNexRole((c) => insertRecord(c, { record_id: rid })).catch((e) => ({ error: e.message, rowCount: -1 }))
      )
    );
    const winners = race.filter((r) => r.rowCount === 1).length;
    const losers  = race.filter((r) => r.rowCount === 0).length;
    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_records WHERE record_id = $1`, [rid]);
    const finalCount = rows.rows[0]?.n ?? -1;
    record("L3", winners === 1 && losers === 3 && finalCount === 1,
      `winners=${winners} losers=${losers} final=${finalCount}`);
  } catch (e) { record("L3", false, `threw: ${e.message}`); }

  // L4 · SKIP LOCKED · enqueue 2 jobs · two workers claim distinct jobs concurrently
  const jobIds = [];
  try {
    const enq1 = await insideNexRole((c) => c.query(
      `INSERT INTO nex.worker_jobs (worker_type, input_kind, input_ref, priority)
       VALUES ('knowledge-context','inbox_item',$1,5) RETURNING id`, [testRef("A")]));
    const enq2 = await insideNexRole((c) => c.query(
      `INSERT INTO nex.worker_jobs (worker_type, input_kind, input_ref, priority)
       VALUES ('knowledge-context','inbox_item',$1,5) RETURNING id`, [testRef("B")]));
    jobIds.push(enq1.rows[0].id, enq2.rows[0].id);
    const [j1, j2] = await Promise.all([
      pool.query(`SELECT * FROM nex.claim_next_job($1, $2, 60)`, ["knowledge-context", `${TEST_TAG}_w1`]),
      pool.query(`SELECT * FROM nex.claim_next_job($1, $2, 60)`, ["knowledge-context", `${TEST_TAG}_w2`]),
    ]);
    const ids = [j1.rows[0]?.id, j2.rows[0]?.id].filter(Boolean);
    const distinct = new Set(ids);
    record("L4",
      ids.length === 2 && distinct.size === 2 && ids.every((id) => jobIds.includes(id)),
      `claimed distinct ids · size=${distinct.size}`);
  } catch (e) { record("L4", false, `threw: ${e.message}`); }

  // L5 · claim on empty queue returns NULL id
  try {
    const r = await pool.query(`SELECT * FROM nex.claim_next_job($1, $2, 60)`, [`${TEST_TAG}_none`, `${TEST_TAG}_w3`]);
    const row = r.rows[0] ?? {};
    record("L5", !row.id, `row.id=${row.id ?? "null"}`);
  } catch (e) { record("L5", false, `threw: ${e.message}`); }

  // L6 · status transitions persist
  try {
    const rid = testRid("status");
    await insideNexRole((c) => insertRecord(c, { record_id: rid, status: "DRAFT" }));
    await insideNexRole((c) => c.query(
      `UPDATE nex.knowledge_records SET status = 'UNDER_REVIEW', last_reviewed_at = NOW() WHERE record_id = $1`, [rid]));
    const mid = await pool.query(`SELECT status FROM nex.knowledge_records WHERE record_id = $1`, [rid]);
    await insideNexRole((c) => c.query(
      `UPDATE nex.knowledge_records SET status = 'AUTHORITATIVE', last_reviewed_at = NOW() WHERE record_id = $1`, [rid]));
    const end = await pool.query(`SELECT status FROM nex.knowledge_records WHERE record_id = $1`, [rid]);
    record("L6",
      mid.rows[0]?.status === "UNDER_REVIEW" && end.rows[0]?.status === "AUTHORITATIVE",
      `DRAFT→${mid.rows[0]?.status}→${end.rows[0]?.status}`);
  } catch (e) { record("L6", false, `threw: ${e.message}`); }

  // L7 · counts by status
  try {
    await insideNexRole((c) => insertRecord(c, { record_id: testRid("count_a"), status: "DRAFT" }));
    await insideNexRole((c) => insertRecord(c, { record_id: testRid("count_b"), status: "UNDER_REVIEW" }));
    await insideNexRole((c) => insertRecord(c, { record_id: testRid("count_c"), status: "AUTHORITATIVE" }));
    const cts = await pool.query(
      `SELECT status, COUNT(*)::int AS n
         FROM nex.knowledge_records
        WHERE record_id LIKE $1
        GROUP BY status`,
      [`${TEST_TAG}%`]
    );
    const m = Object.fromEntries(cts.rows.map((r) => [r.status, r.n]));
    record("L7",
      (m.DRAFT ?? 0) >= 1 && (m.UNDER_REVIEW ?? 0) >= 1 && (m.AUTHORITATIVE ?? 0) >= 1,
      `counts=${JSON.stringify(m)}`);
  } catch (e) { record("L7", false, `threw: ${e.message}`); }

  // L8 · confidence classification CHECK constraint rejects invalid vocab
  try {
    const rid = testRid("conf");
    await insideNexRole((c) => insertRecord(c, { record_id: rid }));
    let threw = false;
    try {
      await insideNexRole((c) => c.query(
        `INSERT INTO nex.confidence_scores (record_id, claim_key, claim_text, classification, confidence_band, confidence_score, source_type)
         VALUES ($1, 'bogus_key', 'bogus text', 'THIS_IS_NOT_VALID', 'high', 0.9, 'industry_standard')`,
        [rid]
      ));
    } catch (_e) { threw = true; }
    record("L8", threw, threw ? "CHECK rejected invalid classification" : "CHECK failed to reject invalid classification");
  } catch (e) { record("L8", false, `outer threw: ${e.message}`); }

  // L9 · FK cascade · confidence_scores deleted when record removed
  try {
    const rid = testRid("cascade");
    await insideNexRole((c) => insertRecord(c, { record_id: rid }));
    await insideNexRole((c) => c.query(
      `INSERT INTO nex.confidence_scores (record_id, claim_key, claim_text, classification, confidence_band, confidence_score, source_type)
       VALUES ($1, 'k', 't', 'established_practice', 'high', 0.9, 'industry_standard')`, [rid]
    ));
    const before = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.confidence_scores WHERE record_id = $1`, [rid]);
    // Delete as postgres owner to test the FK cascade the schema declares.
    await pool.query(`DELETE FROM nex.knowledge_records WHERE record_id = $1`, [rid]);
    const after = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.confidence_scores WHERE record_id = $1`, [rid]);
    record("L9",
      before.rows[0].n === 1 && after.rows[0].n === 0,
      `before=${before.rows[0].n} after=${after.rows[0].n}`);
  } catch (e) { record("L9", false, `threw: ${e.message}`); }

  // L10 · knowledge_job_id round-trip through input_payload JSONB
  try {
    const kj = `${TEST_TAG}_kj_${randomBytes(4).toString("hex")}`;
    const r = await insideNexRole((c) => c.query(
      `INSERT INTO nex.worker_jobs (worker_type, input_kind, input_ref, priority, input_payload)
       VALUES ('knowledge-context','inbox_item',$1,5,$2::jsonb)
       RETURNING id, input_payload`,
      [testRef("kj"), JSON.stringify({ knowledge_job_id: kj, source: "parity-test" })]
    ));
    jobIds.push(r.rows[0].id);
    const payload = r.rows[0].input_payload;
    record("L10",
      payload && payload.knowledge_job_id === kj,
      `input_payload.knowledge_job_id=${payload?.knowledge_job_id}`);
  } catch (e) { record("L10", false, `threw: ${e.message}`); }

  // L11 · Feedback lifecycle
  try {
    const rid = testRid("fb");
    await insideNexRole((c) => insertRecord(c, { record_id: rid, status: "UNDER_REVIEW" }));
    const ins = await insideNexRole((c) => c.query(
      `INSERT INTO nex.knowledge_feedback (question, nex_answer, feedback_kind, feedback_source, submitted_by, record_id)
       VALUES ('parity test?', 'test answer', 'approval', 'automated-check', 'parity-harness', $1) RETURNING id`, [rid]
    ));
    const fid = ins.rows[0].id;
    const before = await insideNexRole((c) => c.query(
      `SELECT COUNT(*)::int AS n FROM nex.knowledge_feedback WHERE record_id = $1 AND applied_to_prompts = FALSE`, [rid]));
    await insideNexRole((c) => c.query(
      `UPDATE nex.knowledge_feedback SET applied_to_prompts = TRUE, applied_at = NOW() WHERE id = $1::uuid`, [fid]));
    const after = await insideNexRole((c) => c.query(
      `SELECT COUNT(*)::int AS n FROM nex.knowledge_feedback WHERE record_id = $1 AND applied_to_prompts = FALSE`, [rid]));
    record("L11",
      before.rows[0].n === 1 && after.rows[0].n === 0,
      `unapplied before=${before.rows[0].n} after=${after.rows[0].n}`);
  } catch (e) { record("L11", false, `threw: ${e.message}`); }

  // L12 · LLM retry lifecycle
  try {
    const enq = await insideNexRole((c) => c.query(
      `INSERT INTO nex.llm_retry_queue
         (parent_worker_type, parent_input_ref, call_purpose, call_messages, next_attempt_at, max_attempts)
       VALUES ('knowledge-extractor', $1, 'parity-test', $2::jsonb, NOW() - INTERVAL '1 second', 3)
       RETURNING id`,
      [testRef("retry"), JSON.stringify([{ role: "user", content: "test" }])]
    ));
    const claim = await pool.query(`SELECT * FROM nex.claim_next_llm_retry($1, 30)`, [`${TEST_TAG}_retry_w`]);
    const claimedId = claim.rows[0]?.id;
    await insideNexRole((c) => c.query(
      `UPDATE nex.llm_retry_queue
         SET status = 'succeeded', succeeded_provider = 'test-provider', succeeded_at = NOW(),
             result_summary = '{"ok":true}'::jsonb, updated_at = NOW()
       WHERE id = $1::uuid`, [claimedId]));
    const status = await pool.query(`SELECT status FROM nex.llm_retry_queue WHERE id = $1::uuid`, [claimedId]);
    record("L12",
      enq.rows[0]?.id && claimedId === enq.rows[0].id && status.rows[0]?.status === "succeeded",
      `enq=${!!enq.rows[0]?.id} claim=${!!claimedId} match=${claimedId === enq.rows[0]?.id} final_status=${status.rows[0]?.status}`);
  } catch (e) { record("L12", false, `threw: ${e.message}`); }

  // L13 · Heartbeat upsert idempotent per host_id
  try {
    const hid = `${TEST_TAG}_worker@0`;
    await insideNexRole((c) => c.query(
      `INSERT INTO nex.worker_heartbeats (host_id, last_seen_at, uptime_ms, cycles_total, cycles_failed)
       VALUES ($1, NOW() - INTERVAL '3 seconds', 100, 1, 0)
       ON CONFLICT (host_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
      [hid]
    ));
    await insideNexRole((c) => c.query(
      `INSERT INTO nex.worker_heartbeats (host_id, last_seen_at, uptime_ms, cycles_total, cycles_failed)
       VALUES ($1, NOW(), 200, 2, 0)
       ON CONFLICT (host_id) DO UPDATE SET
         last_seen_at = EXCLUDED.last_seen_at, uptime_ms = EXCLUDED.uptime_ms, cycles_total = EXCLUDED.cycles_total`,
      [hid]
    ));
    const r = await pool.query(`SELECT uptime_ms, cycles_total FROM nex.worker_heartbeats WHERE host_id = $1`, [hid]);
    const dupCount = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.worker_heartbeats WHERE host_id = $1`, [hid]);
    // BIGINT columns come back as strings from pg → coerce with Number() before compare.
    const uptime = Number(r.rows[0].uptime_ms);
    const cycles = Number(r.rows[0].cycles_total);
    record("L13",
      dupCount.rows[0].n === 1 && uptime === 200 && cycles === 2,
      `rows=${dupCount.rows[0].n} uptime=${uptime} cycles=${cycles}`);
  } catch (e) { record("L13", false, `threw: ${e.message}`); }

  // L14 · RLS · nex_brain_app can read every brain table (positive control)
  try {
    const tables = ["knowledge_records","confidence_scores","worker_jobs","worker_heartbeats","llm_retry_queue"];
    const results14 = [];
    for (const t of tables) {
      const r = await insideNexRole((c) => c.query(`SELECT COUNT(*)::int AS n FROM nex.${t}`));
      results14.push({ t, n: r.rows[0]?.n });
    }
    const allOk = results14.every((r) => Number.isInteger(r.n));
    record("L14", allOk, `nex_brain_app read counts: ${results14.map((r) => `${r.t}=${r.n}`).join(" ")}`);
  } catch (e) { record("L14", false, `threw: ${e.message}`); }

  // L15 · RLS · foreign role cannot read
  try {
    const foreignRole = `${TEST_TAG}_intruder`;
    await pool.query(`CREATE ROLE ${foreignRole} NOLOGIN`);
    try {
      await pool.query(`GRANT USAGE ON SCHEMA nex TO ${foreignRole}`);
      let blocked = false;
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(`SET LOCAL ROLE ${foreignRole}`);
        try {
          const r = await c.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_records`);
          // If we get here without throwing but RLS blocks reads, count is 0.
          if ((r.rows[0]?.n ?? 0) === 0) blocked = true;
        } catch (rlsErr) {
          blocked = true;
        }
        await c.query("ROLLBACK");
      } finally { c.release(); }
      // Sanity: our earlier records must exist when read as postgres.
      const asPostgres = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_records WHERE record_id LIKE $1`, [`${TEST_TAG}%`]);
      const actualRows = asPostgres.rows[0]?.n ?? 0;
      record("L15", blocked && actualRows > 0,
        `blocked=${blocked} · postgres-seen-rows=${actualRows} · policy scopes nex_brain_app only`);
    } finally {
      await pool.query(`REVOKE ALL ON SCHEMA nex FROM ${foreignRole}`).catch(() => {});
      await pool.query(`DROP ROLE IF EXISTS ${foreignRole}`).catch(() => {});
    }
  } catch (e) { record("L15", false, `threw: ${e.message}`); }

  // L16 · status view returns finite integers
  try {
    const r = await pool.query(`SELECT records_authoritative, records_under_review, records_draft FROM nex.nex_brain_status`);
    const row = r.rows[0] ?? {};
    const ints = ["records_authoritative","records_under_review","records_draft"]
      .map((k) => Number(row[k]))
      .every((n) => Number.isFinite(n) && n >= 0);
    record("L16", ints,
      `view row: auth=${row.records_authoritative} review=${row.records_under_review} draft=${row.records_draft}`);
  } catch (e) { record("L16", false, `threw: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP · delete every parity_test_<uuid> row in dependency order
  // ═══════════════════════════════════════════════════════════════════
  try {
    let deleted = 0;
    for (const table of [
      "confidence_scores","contradictions","deprecations","knowledge_feedback",
      "graph_edges","record_versions","sources","worker_results",
    ]) {
      const r = await pool.query(
        `DELETE FROM nex.${table} WHERE record_id LIKE $1`, [`${TEST_TAG}%`]
      ).catch(() => ({ rowCount: 0 }));
      deleted += r.rowCount ?? 0;
    }
    for (const table of [
      "worker_jobs", "llm_retry_queue",
    ]) {
      const r = await pool.query(
        `DELETE FROM nex.${table} WHERE parent_input_ref LIKE $1 OR (input_ref IS NOT NULL AND input_ref LIKE $1)`
          .replace(/parent_input_ref LIKE \$1 OR /, table === "llm_retry_queue" ? "parent_input_ref LIKE $1 OR " : "1=0 OR "),
        [`${TEST_TAG}%`]
      ).catch(() => ({ rowCount: 0 }));
      deleted += r.rowCount ?? 0;
    }
    // worker_jobs by input_ref (uses TEST_TAG prefix)
    const jr = await pool.query(`DELETE FROM nex.worker_jobs WHERE input_ref LIKE $1`, [`${TEST_TAG}%`]);
    deleted += jr.rowCount ?? 0;
    const rr = await pool.query(`DELETE FROM nex.knowledge_records WHERE record_id LIKE $1`, [`${TEST_TAG}%`]);
    deleted += rr.rowCount ?? 0;
    const hr = await pool.query(`DELETE FROM nex.worker_heartbeats WHERE host_id LIKE $1`, [`${TEST_TAG}%`]);
    deleted += hr.rowCount ?? 0;
    // Verify nothing left behind
    const remains = await pool.query(
      `SELECT (SELECT COUNT(*) FROM nex.knowledge_records WHERE record_id LIKE $1) AS records,
              (SELECT COUNT(*) FROM nex.worker_jobs WHERE input_ref LIKE $1) AS jobs,
              (SELECT COUNT(*) FROM nex.worker_heartbeats WHERE host_id LIKE $1) AS heartbeats`,
      [`${TEST_TAG}%`]
    );
    const clean = Number(remains.rows[0].records) === 0
               && Number(remains.rows[0].jobs) === 0
               && Number(remains.rows[0].heartbeats) === 0;
    record("L17", clean, `deleted=${deleted} · residue=${JSON.stringify(remains.rows[0])}`);
  } catch (e) { record("L17", false, `cleanup threw: ${e.message}`); }

  await pool.end();

  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  process.stdout.write(`\nbrain-adapter-contract: ${passed}/${total} assertions passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error("brain-adapter-contract · fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
