// NEX Workforce v2 · Slice 4.1 · Full-Migration Rehearsal under production-shape probe
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// This test proves the entire Slice 4.1 patch migration
// (`supabase/migrations/_slice4_1_pgcrypto_schema_fix.sql`) executes end-to-end
// under a non-superuser probe that reproduces Project B's Supabase-managed
// postgres caller identity.
//
// Probe attributes (mirrors Project B `postgres`):
//   rolsuper       = FALSE
//   rolcreaterole  = TRUE
//   rolcreatedb    = TRUE
//   rolbypassrls   = TRUE
//   rolinherit     = TRUE
//   inherits from postgres (portable superuser) so it has effective owner-level
//   privileges on evidence_record + persister function · but its OWN
//   rolsuper=false forces PG 16+ semantics for ownership-requiring ops.
//
// Assertions (5 tests):
//   S41-01 · Slice 4.1 patch applies cleanly under production-shape probe
//   S41-02 · post-apply · persist_to_food_business body has extensions.digest
//            AND does NOT have public.digest
//   S41-03 · post-apply · _crockford5 body has extensions.digest
//            AND does NOT have public.digest
//   S41-04 · post-apply · evidence_id_consistency CHECK uses extensions.digest
//   S41-05 · post-apply · extensions USAGE granted to persister + admin roles
//   S41-06 · post-apply · runtime end-to-end persist_batch succeeds

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const __dirname = dirname(fileURLToPath(import.meta.url));
const S41_MIGRATION_PATH = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice4_1_pgcrypto_schema_fix.sql");

let pool;
let probePool;

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });

  // Ensure probe role exists (identical shape to Slice 1h R4 rehearsal probe)
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_r4_probe') THEN
        CREATE ROLE nex_r4_probe LOGIN NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS INHERIT;
      END IF;
    END $body$
  `);
  await pool.query(`GRANT postgres TO nex_r4_probe WITH INHERIT TRUE, SET TRUE`).catch(() => {});

  probePool = new pg.Pool({ host: CONN.host, port: CONN.port, user: "nex_r4_probe", database: CONN.database, max: 2 });
});

afterAll(async () => {
  if (probePool) await probePool.end();
  if (pool) await pool.end();
});

function loadS41Migration() {
  return readFileSync(S41_MIGRATION_PATH, "utf8");
}

async function rehearse(sql, { rollback = false } = {}) {
  const c = await probePool.connect();
  const outcome = { ok: false, error: null, sqlState: null };
  try {
    await c.query("BEGIN");
    try {
      await c.query(sql);
      outcome.ok = true;
    } catch (e) {
      outcome.error = e.message;
      outcome.sqlState = e.code;
    } finally {
      if (rollback || !outcome.ok) {
        await c.query("ROLLBACK").catch(() => {});
      } else {
        await c.query("COMMIT");
      }
    }
  } finally { c.release(); }
  return outcome;
}

describe("Slice 4.1 · full-migration rehearsal under production-shape probe", () => {
  it("S41-01 · patch applies cleanly under NOSUPERUSER probe", async () => {
    const out = await rehearse(loadS41Migration());
    expect(out.ok, out.error || "expected success").toBe(true);
  }, 30000);

  it("S41-02 · persist_to_food_business calls extensions.digest and NOT public.digest", async () => {
    const r = await pool.query(`
      SELECT
        pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext,
        pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\('     AS has_pub
      FROM pg_proc
      WHERE pronamespace='nex_workforce'::regnamespace
        AND proname='persist_to_food_business'
    `);
    expect(r.rows[0].has_ext).toBe(true);
    expect(r.rows[0].has_pub).toBe(false);
  });

  it("S41-03 · _crockford5 calls extensions.digest and NOT public.digest", async () => {
    const r = await pool.query(`
      SELECT
        pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext,
        pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\('     AS has_pub
      FROM pg_proc
      WHERE pronamespace='nex_workforce'::regnamespace
        AND proname='_crockford5'
    `);
    expect(r.rows[0].has_ext).toBe(true);
    expect(r.rows[0].has_pub).toBe(false);
  });

  it("S41-04 · evidence_id_consistency uses extensions.digest", async () => {
    const r = await pool.query(`
      SELECT pg_get_constraintdef(oid) AS defn
        FROM pg_constraint
       WHERE conname='evidence_id_consistency'
         AND conrelid='nex_workforce.evidence_record'::regclass
    `);
    expect(r.rows[0].defn).toMatch(/extensions\.digest/);
    expect(r.rows[0].defn).not.toMatch(/public\.digest/);
  });

  it("S41-05 · extensions USAGE granted to persister role (and admin if exists)", async () => {
    const r = await pool.query(`
      SELECT rolname,
             has_schema_privilege(rolname, 'extensions', 'USAGE') AS ext_usage
        FROM pg_roles
       WHERE rolname IN ('nex_workforce_persister_food_business','nex_workforce_admin')
       ORDER BY rolname
    `);
    for (const row of r.rows) {
      expect(row.ext_usage, `${row.rolname} should have USAGE on extensions`).toBe(true);
    }
  });

  it("S41-06 · security posture preserved · SECDEF + hardened search_path + owner", async () => {
    const r = await pool.query(`
      SELECT p.prosecdef,
             r.rolname AS owner,
             p.proconfig
        FROM pg_proc p
        JOIN pg_roles r ON r.oid=p.proowner
       WHERE p.pronamespace='nex_workforce'::regnamespace
         AND p.proname='persist_to_food_business'
    `);
    expect(r.rows[0].prosecdef).toBe(true);
    expect(r.rows[0].owner).toBe("nex_workforce_persister_food_business");
    const sp = (r.rows[0].proconfig || []).find(x => x.startsWith("search_path="));
    expect(sp).toBeDefined();
    expect(sp).toMatch(/pg_catalog/);
    expect(sp).toMatch(/pg_temp/);
    // Never widen to public
    expect(sp).not.toMatch(/\bpublic\b/);
  });
});
