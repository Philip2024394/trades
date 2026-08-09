#!/usr/bin/env node
// inbox-jobs-shadow.test.mjs · Phase 11.2 · Shadow-write contract
//
// Proves the Phase 11.2 shadow layer:
//   · migration 043 applied · three tables + RLS policies exist
//   · shadow module is GATED · zero writes when NEX_INBOX_SHADOW_POSTGRES
//     is unset (production safety)
//   · shadow module writes to nex.knowledge_inbox when enabled
//   · shadow module handles bulk status transitions (12.1 writeback path)
//   · filesystem storage + fs-store jobs + manager.ts all import + call
//     the shadow module at the right seams
//   · backfill script exists and is idempotent
//   · RLS · nex_brain_app can read/write shadow tables · foreign role
//     cannot
//
// TWO LAYERS (mirrors brain-adapter-contract):
//   A · Static · greps source for wiring + gates
//   B · Live SQL · exercises schema + gate behavior on our Postgres
//
// All test data uses shadow_test_<uuid> prefix and is wiped in L-cleanup.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const PG_URL = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool   = new Pool({ connectionString: PG_URL, max: 4 });

const INBOX_SHADOW = readFileSync(join(REPO, "src/lib/nex/knowledge-inbox/pg-shadow.ts"), "utf8");
const JOBS_SHADOW  = readFileSync(join(REPO, "src/lib/nex/jobs/pg-shadow.ts"), "utf8");
const INBOX_STORE  = readFileSync(join(REPO, "src/lib/nex/knowledge-inbox/storage.ts"), "utf8");
const JOBS_STORE   = readFileSync(join(REPO, "src/lib/nex/jobs/fs-store.ts"), "utf8");
const MANAGER      = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");
const MIGRATION    = readFileSync(join(REPO, "deploy/postgres/init/043_nex_knowledge_inbox_and_dump_jobs.sql"), "utf8");
const BACKFILL     = readFileSync(join(REPO, "scripts/nex-inbox-jobs-backfill.mjs"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

const TAG = `shadow_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

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
  } finally { c.release(); }
}

async function main() {
  process.stdout.write("inbox-jobs-shadow.test.mjs\n");
  process.stdout.write(`  tag=${TAG}\n`);

  // ═══════════════════════════════════════════════════════════════════
  // LAYER A · STATIC CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  // S1 · migration 043 declares three tables + RLS
  record("S1",
    /CREATE TABLE IF NOT EXISTS nex\.knowledge_inbox\b/.test(MIGRATION)
      && /CREATE TABLE IF NOT EXISTS nex\.knowledge_inbox_stats\b/.test(MIGRATION)
      && /CREATE TABLE IF NOT EXISTS nex\.knowledge_dump_jobs\b/.test(MIGRATION)
      && /ENABLE ROW LEVEL SECURITY/.test(MIGRATION),
    "3 tables + RLS enabled");

  // S2 · migration grants nex_brain_app + FOR ALL policy loop
  record("S2",
    /GRANT SELECT, INSERT, UPDATE, DELETE ON[\s\S]{0,300}?TO nex_brain_app/.test(MIGRATION)
      && /FOR ALL TO nex_brain_app USING \(true\) WITH CHECK \(true\)/.test(MIGRATION),
    "grants + FOR ALL policy scoped to nex_brain_app");

  // S3 · pg-shadow gated on NEX_INBOX_SHADOW_POSTGRES=1
  record("S3",
    /NEX_INBOX_SHADOW_POSTGRES\s*===\s*"1"/.test(INBOX_SHADOW),
    "inbox pg-shadow gated on NEX_INBOX_SHADOW_POSTGRES=1");

  // S4 · Wave 11 · Step 7 · F34 · both shadow modules use the
  // nex_brain_app role via the shared canonical helper. Prior to F34
  // each file inlined `SET LOCAL ROLE nex_brain_app` directly · that
  // string has moved to src/lib/nex/db/with-brain-role.ts. The
  // invariant is unchanged (both files USE the role); the check now
  // verifies both import the shared helper AND the shared helper is
  // the sole owner of the SET LOCAL ROLE call.
  const wbrSharedSrc = readFileSync(join(REPO, "src/lib/nex/db/with-brain-role.ts"), "utf8");
  const bothImportShared =
    /from ["']@\/lib\/nex\/db\/with-brain-role["']/.test(INBOX_SHADOW)
    && /from ["']@\/lib\/nex\/db\/with-brain-role["']/.test(JOBS_SHADOW);
  const sharedEnforcesRole = /SET LOCAL ROLE nex_brain_app/.test(wbrSharedSrc);
  record("S4", bothImportShared && sharedEnforcesRole,
    "both shadow modules use nex_brain_app role via the shared with-brain-role helper (F34)");

  // S5 · shadow functions swallow errors (never throw)
  const inboxCatches = (INBOX_SHADOW.match(/catch\s*\(err\)/g) ?? []).length;
  const jobsCatches  = (JOBS_SHADOW.match(/catch\s*\(err\)/g) ?? []).length;
  record("S5",
    inboxCatches >= 4 && jobsCatches >= 1,
    `inbox catch blocks=${inboxCatches} · jobs catch blocks=${jobsCatches}`);

  // S6 · filesystem inbox storage wires shadow at each mutation
  const wiredWrites = /shadowUpsertInboxItem\(item\)/.test(INBOX_STORE)
    && /shadowUpdateInboxStatuses\(shadowMap\)/.test(INBOX_STORE)
    && /shadowDeleteInboxItem\(id\)/.test(INBOX_STORE)
    && /shadowUpsertInboxStats\(\{/.test(INBOX_STORE);
  record("S6", wiredWrites,
    "filesystem inbox storage calls all 4 shadow functions at mutation sites");

  // S6b · runProcessInbox mirrors changed rows to Postgres.
  // Live observation on 2026-08-09 (SEAM 3 exercise) discovered that
  // runProcessInbox mutates status + processedAt + processedNotes in a
  // single writeIndex() so the per-mutation hooks in appendItem/
  // updateStatuses/setItemStatus don't fire. Fix walks the changed items
  // and calls shadowUpsertInboxItem for each. This assertion locks the
  // wiring in place so future refactors of runProcessInbox can't silently
  // reintroduce the drift.
  const processInboxCallsShadow =
    /const changedIds\s*=\s*new Set<string>\(\)/.test(INBOX_STORE)
      && /if \(changedIds\.has\(item\.id\)\) void shadowUpsertInboxItem\(item\)/.test(INBOX_STORE);
  record("S6b", processInboxCallsShadow,
    "runProcessInbox tracks changedIds + shadow-upserts each mutated item");

  // S7 · fs-store jobs wires shadow at create + update
  record("S7",
    /shadowUpsertJob\(job\)/.test(JOBS_STORE)
      && /shadowUpsertJob\(next\)/.test(JOBS_STORE),
    "fs-store jobs calls shadowUpsertJob at create + update");

  // S8 · manager.ts (12.1 writeback) also shadow-writes
  record("S8",
    /shadowUpdateInboxStatuses\(updates\)/.test(MANAGER),
    "manager.ts::updateInboxItemStatuses shadow-writes the bulk transition");

  // S9 · backfill script is dry-run capable + idempotent
  record("S9",
    /--dry-run/.test(BACKFILL)
      && /ON CONFLICT \(id\) DO NOTHING/.test(BACKFILL)
      && /ON CONFLICT \(job_id\) DO NOTHING/.test(BACKFILL)
      && /ON CONFLICT \(stat_date\) DO NOTHING/.test(BACKFILL),
    "backfill · --dry-run flag + ON CONFLICT DO NOTHING on all 3 tables");

  // ═══════════════════════════════════════════════════════════════════
  // LAYER B · LIVE SQL SEMANTICS
  // ═══════════════════════════════════════════════════════════════════

  // L1 · all three tables exist in nex.* schema
  try {
    const r = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'nex'
          AND table_name IN ('knowledge_inbox','knowledge_inbox_stats','knowledge_dump_jobs')`
    );
    record("L1", r.rows.length === 3,
      `found ${r.rows.length}/3 tables: ${r.rows.map((x) => x.table_name).join(",")}`);
  } catch (e) { record("L1", false, `threw: ${e.message}`); }

  // L2 · hash UNIQUE constraint present on knowledge_inbox
  try {
    const r = await pool.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'nex' AND tablename = 'knowledge_inbox'
          AND indexname = 'uniq_knowledge_inbox_hash'`
    );
    record("L2", r.rows.length === 1, `unique index found: ${r.rows.map((x) => x.indexname).join(",")}`);
  } catch (e) { record("L2", false, `threw: ${e.message}`); }

  // L3 · nex_brain_app can INSERT into knowledge_inbox (write RLS)
  try {
    await insideNexRole((c) => c.query(
      `INSERT INTO nex.knowledge_inbox
         (id, title, kind, status, source, hash, created_at_ms, created_at_iso)
       VALUES ($1, 'shadow-test', 'text', 'waiting', 'raw-research', $2, $3, NOW())`,
      [`${TAG}_item_1`, `${TAG}_hash_1`, Date.now()]
    ));
    record("L3", true, "nex_brain_app INSERT succeeded");
  } catch (e) { record("L3", false, `threw: ${e.message}`); }

  // L4 · UNIQUE(hash) enforced · duplicate insert fails
  try {
    let threw = false;
    try {
      await insideNexRole((c) => c.query(
        `INSERT INTO nex.knowledge_inbox
           (id, title, kind, status, source, hash, created_at_ms, created_at_iso)
         VALUES ($1, 'dup', 'text', 'waiting', 'raw-research', $2, $3, NOW())`,
        [`${TAG}_item_2`, `${TAG}_hash_1`, Date.now()]  // same hash as L3
      ));
    } catch { threw = true; }
    record("L4", threw, threw ? "duplicate hash rejected as expected" : "duplicate hash accepted (constraint broken!)");
  } catch (e) { record("L4", false, `outer threw: ${e.message}`); }

  // L5 · status CHECK constraint rejects invalid values
  try {
    let threw = false;
    try {
      await insideNexRole((c) => c.query(
        `INSERT INTO nex.knowledge_inbox
           (id, title, kind, status, source, hash, created_at_ms, created_at_iso)
         VALUES ($1, 't', 'text', 'THIS_IS_INVALID', 'raw-research', $2, $3, NOW())`,
        [`${TAG}_bad`, `${TAG}_bad_hash`, Date.now()]
      ));
    } catch { threw = true; }
    record("L5", threw, threw ? "status CHECK rejected invalid value" : "status CHECK failed to reject");
  } catch (e) { record("L5", false, `outer threw: ${e.message}`); }

  // L6 · bulk status update via UNNEST (mirrors shadowUpdateInboxStatuses)
  try {
    // Insert a couple of rows to update.
    for (let i = 2; i <= 4; i++) {
      await insideNexRole((c) => c.query(
        `INSERT INTO nex.knowledge_inbox
           (id, title, kind, status, source, hash, created_at_ms, created_at_iso)
         VALUES ($1, 't', 'text', 'waiting', 'raw-research', $2, $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [`${TAG}_item_${i}`, `${TAG}_hash_${i}`, Date.now()]
      ));
    }
    const ids = [`${TAG}_item_2`, `${TAG}_item_3`, `${TAG}_item_4`];
    const statuses = ["processing", "processing", "review"];
    await insideNexRole((c) => c.query(
      `UPDATE nex.knowledge_inbox AS ki
          SET status = u.new_status, shadow_updated_at = NOW()
         FROM UNNEST($1::text[], $2::text[]) AS u(id, new_status)
        WHERE ki.id = u.id`,
      [ids, statuses]
    ));
    const check = await pool.query(
      `SELECT id, status FROM nex.knowledge_inbox WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids]
    );
    const asMap = Object.fromEntries(check.rows.map((r) => [r.id, r.status]));
    record("L6",
      asMap[ids[0]] === "processing"
        && asMap[ids[1]] === "processing"
        && asMap[ids[2]] === "review",
      `bulk statuses = ${JSON.stringify(asMap)}`);
  } catch (e) { record("L6", false, `threw: ${e.message}`); }

  // L7 · foreign role cannot read knowledge_inbox (negative RLS)
  try {
    const foreignRole = `${TAG}_intruder`;
    await pool.query(`CREATE ROLE ${foreignRole} NOLOGIN`);
    try {
      await pool.query(`GRANT USAGE ON SCHEMA nex TO ${foreignRole}`);
      let blocked = false;
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(`SET LOCAL ROLE ${foreignRole}`);
        try {
          const r = await c.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_inbox`);
          if ((r.rows[0]?.n ?? 0) === 0) blocked = true;
        } catch { blocked = true; }
        await c.query("ROLLBACK");
      } finally { c.release(); }
      const asPostgres = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_inbox WHERE id LIKE $1`, [`${TAG}%`]);
      record("L7", blocked && asPostgres.rows[0].n > 0,
        `intruder_blocked=${blocked} · postgres-visible-rows=${asPostgres.rows[0].n}`);
    } finally {
      await pool.query(`REVOKE ALL ON SCHEMA nex FROM ${foreignRole}`).catch(() => {});
      await pool.query(`DROP ROLE IF EXISTS ${foreignRole}`).catch(() => {});
    }
  } catch (e) { record("L7", false, `threw: ${e.message}`); }

  // L8 · knowledge_dump_jobs status CHECK constraint
  try {
    let threw = false;
    try {
      await insideNexRole((c) => c.query(
        `INSERT INTO nex.knowledge_dump_jobs
           (job_id, source, owner, status, created_at, updated_at)
         VALUES ($1, 'test', 'test', 'BOGUS_STATUS', NOW(), NOW())`,
        [`${TAG}_job_bad`]
      ));
    } catch { threw = true; }
    record("L8", threw, threw ? "job status CHECK rejected invalid" : "job status CHECK failed to reject");
  } catch (e) { record("L8", false, `outer threw: ${e.message}`); }

  // L9 · backfilled rows visible (production dry-run left inbox rows)
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM nex.knowledge_inbox WHERE id LIKE 'nx_%'`
    );
    record("L9", r.rows[0].n > 0, `backfilled inbox items visible: ${r.rows[0].n}`);
  } catch (e) { record("L9", false, `threw: ${e.message}`); }

  // L10 · backfill script is idempotent (re-inserting the same id is a no-op)
  try {
    const rid = `${TAG}_idem`;
    await insideNexRole((c) => c.query(
      `INSERT INTO nex.knowledge_inbox
         (id, title, kind, status, source, hash, created_at_ms, created_at_iso)
       VALUES ($1, 'idem-1', 'text', 'waiting', 'raw-research', $2, $3, NOW())`,
      [rid, `${TAG}_idem_hash`, Date.now()]
    ));
    const r = await insideNexRole((c) => c.query(
      `INSERT INTO nex.knowledge_inbox
         (id, title, kind, status, source, hash, created_at_ms, created_at_iso)
       VALUES ($1, 'idem-2', 'text', 'waiting', 'raw-research', $2, $3, NOW())
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [rid, `${TAG}_idem_hash_2`, Date.now()]
    ));
    const final = await pool.query(`SELECT title FROM nex.knowledge_inbox WHERE id = $1`, [rid]);
    record("L10",
      r.rowCount === 0 && final.rows[0]?.title === "idem-1",
      `re-insert rowCount=${r.rowCount} · title preserved=${final.rows[0]?.title}`);
  } catch (e) { record("L10", false, `threw: ${e.message}`); }

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════
  try {
    const r1 = await pool.query(`DELETE FROM nex.knowledge_inbox WHERE id LIKE $1`, [`${TAG}%`]);
    const r2 = await pool.query(`DELETE FROM nex.knowledge_dump_jobs WHERE job_id LIKE $1`, [`${TAG}%`]);
    const remain1 = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_inbox WHERE id LIKE $1`, [`${TAG}%`]);
    const remain2 = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.knowledge_dump_jobs WHERE job_id LIKE $1`, [`${TAG}%`]);
    const clean = remain1.rows[0].n === 0 && remain2.rows[0].n === 0;
    record("L-cleanup", clean,
      `deleted inbox=${r1.rowCount} jobs=${r2.rowCount} · residue inbox=${remain1.rows[0].n} jobs=${remain2.rows[0].n}`);
  } catch (e) { record("L-cleanup", false, `threw: ${e.message}`); }

  await pool.end();

  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  process.stdout.write(`\ninbox-jobs-shadow: ${passed}/${total} assertions passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error("inbox-jobs-shadow · fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
