#!/usr/bin/env node
// extractor-idempotency.test.mjs · Phase 10.2 · Fix #2A regression test
//
// Proves the knowledge-extractor no longer crashes on duplicate
// knowledge_records.record_id inserts. Exercises TWO layers:
//
//   1. The DB-level primitive · Postgres INSERT ... ON CONFLICT DO NOTHING.
//      This is what SupabaseStore.insertRecordIdempotent uses under the
//      hood (via Supabase's upsert with ignoreDuplicates=true, which is
//      the same PostgREST → Postgres semantics). Tested here against
//      OUR OWN Postgres via NEX_POSTGRES_URL — no Supabase dependency.
//      A throwaway table is created and dropped in the test's own schema.
//
//   2. The extractor source · asserts the worker calls
//      insertRecordIdempotent + skips dependent inserts on duplicates.
//
// Prior evidence (2026-08-08 diagnostic): five knowledge-extractor
// failures with identical error:
//   `insertRecord failed: duplicate key value violates unique
//    constraint "knowledge_records_record_id_key"`
//
// Assertions:
//   EI1  · new record_id · INSERT succeeds and returns exactly one row
//   EI2  · duplicate record_id · INSERT ... ON CONFLICT DO NOTHING
//          returns zero rows without raising
//   EI3  · exactly one row exists after both attempts · first-write wins
//   EI4  · concurrent duplicate inserts do not race
//   EI5  · cleanup DROP succeeds
//   EI6  · extractor source imports insertRecordIdempotent
//   EI7  · extractor destructures { record, created }
//   EI8  · extractor tracks noOpRecordIds
//   EI9  · extractor `continue`s dependent inserts when created=false
//   EI10 · extractor result payload carries no_op / no_op_reason on all-duplicate runs
//   EI11 · SupabaseStore uses onConflict:record_id + ignoreDuplicates:true (race-safe)
//   EI12 · LocalFsStore has the idempotent method too (parity across backends)

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const PG_URL = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool   = new Pool({ connectionString: PG_URL, max: 3 });

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

async function main() {
  process.stdout.write("extractor-idempotency.test.mjs\n");

  // ── DB-layer proof · test the ON CONFLICT primitive on OUR OWN Postgres ──
  const suffix    = randomUUID().replace(/-/g, "");
  const tableName = `nex_test_idempotency_${suffix}`;
  const client    = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE ${tableName} (
         id SERIAL PRIMARY KEY,
         record_id TEXT NOT NULL,
         title TEXT NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         CONSTRAINT ${tableName}_record_id_key UNIQUE (record_id)
       )`,
    );

    // EI1 · fresh insert
    const r1 = await client.query(
      `INSERT INTO ${tableName} (record_id, title) VALUES ($1, $2)
         ON CONFLICT (record_id) DO NOTHING RETURNING *`,
      ["nex-first-write-wins", "original title"],
    );
    record("EI1", r1.rowCount === 1 && r1.rows[0].record_id === "nex-first-write-wins", `rowCount=${r1.rowCount}`);

    // EI2 · duplicate insert — returns 0 rows, no error
    let dupThrew = false; let dupRowCount = -1;
    try {
      const r2 = await client.query(
        `INSERT INTO ${tableName} (record_id, title) VALUES ($1, $2)
           ON CONFLICT (record_id) DO NOTHING RETURNING *`,
        ["nex-first-write-wins", "duplicate attempt — must be ignored"],
      );
      dupRowCount = r2.rowCount;
    } catch (e) {
      dupThrew = true;
    }
    record("EI2", !dupThrew && dupRowCount === 0, `threw=${dupThrew} rowCount=${dupRowCount}`);

    // EI3 · exactly ONE row · first-write wins
    const r3 = await client.query(
      `SELECT record_id, title FROM ${tableName} WHERE record_id = $1`,
      ["nex-first-write-wins"],
    );
    const preserved = r3.rowCount === 1 && r3.rows[0].title === "original title";
    record("EI3", preserved, `rows=${r3.rowCount} preserved=${preserved}`);

    // EI4 · concurrent duplicate inserts do not race (both hit ON CONFLICT DO NOTHING)
    const conc = await Promise.all([
      client.query(`INSERT INTO ${tableName} (record_id, title) VALUES ($1, $2) ON CONFLICT (record_id) DO NOTHING RETURNING *`, ["nex-race-key", "A"]),
      client.query(`INSERT INTO ${tableName} (record_id, title) VALUES ($1, $2) ON CONFLICT (record_id) DO NOTHING RETURNING *`, ["nex-race-key", "B"]),
      client.query(`INSERT INTO ${tableName} (record_id, title) VALUES ($1, $2) ON CONFLICT (record_id) DO NOTHING RETURNING *`, ["nex-race-key", "C"]),
    ]);
    const winners = conc.filter((r) => r.rowCount === 1).length;
    const losers  = conc.filter((r) => r.rowCount === 0).length;
    const raceCount = await client.query(`SELECT COUNT(*)::int AS n FROM ${tableName} WHERE record_id = $1`, ["nex-race-key"]);
    record("EI4", winners === 1 && losers === 2 && raceCount.rows[0].n === 1,
      `winners=${winners} losers=${losers} final_rows=${raceCount.rows[0].n}`);

    // EI5 · cleanup
    await client.query(`DROP TABLE ${tableName}`);
    record("EI5", true, "table dropped");
  } catch (e) {
    record("EI1-EI5", false, `exception ${e.message}`);
    try { await client.query(`DROP TABLE IF EXISTS ${tableName}`); } catch { /* best-effort */ }
  } finally {
    client.release();
  }

  // ── Static checks on the extractor + storage source ────────────
  const extractor = readFileSync(join(REPO, "src/lib/nex/brain/workers/knowledge-extractor.ts"), "utf8");
  const storage   = readFileSync(join(REPO, "src/lib/nex/brain/storage.ts"), "utf8");

  record("EI6", /store\.insertRecordIdempotent\s*\(/.test(extractor),
    "extractor calls insertRecordIdempotent");
  record("EI7", /const\s*\{\s*record:\s*draft,\s*created\s*\}\s*=\s*await\s+store\.insertRecordIdempotent/.test(extractor),
    "extractor destructures { record, created }");
  record("EI8", /noOpRecordIds/.test(extractor),
    "extractor tracks noOpRecordIds");
  record("EI9", /if\s*\(\s*!created\s*\)\s*\{[\s\S]{0,140}?continue;\s*\}/.test(extractor),
    "extractor `continue`s dependent inserts when created=false");
  record("EI10", /no_op_reason:\s*allNoOp\s*\?\s*"record_already_exists"/.test(extractor)
             && /no_op:\s*allNoOp/.test(extractor),
    "result payload carries no_op / no_op_reason on all-duplicate runs");
  record("EI11", /ignoreDuplicates:\s*true/.test(storage)
             && /onConflict:\s*"record_id"/.test(storage),
    "SupabaseStore uses onConflict:record_id + ignoreDuplicates:true (race-safe)");
  // EI12 · both backends expose the method (parity)
  const fsHas = /class\s+FilesystemStore\s+implements\s+BrainStore[\s\S]*?insertRecordIdempotent/.test(storage);
  const sbHas = /class\s+SupabaseStore\s+implements\s+BrainStore[\s\S]*?insertRecordIdempotent/.test(storage);
  record("EI12", fsHas && sbHas, `Filesystem=${fsHas} Supabase=${sbHas}`);

  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  process.stdout.write(`\nextractor-idempotency: ${passed}/${total} assertions passed\n`);
  await pool.end();
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
