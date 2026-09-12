// NEX Workforce v2 · Slice 1h R5 · Full-Migration Rehearsal under production-shape probe
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Proves the R5 migration (`_slice1h_r5_multi_city_persister.sql`) applies
// cleanly under a NOSUPERUSER probe that reproduces Project B's Supabase-
// managed postgres attribute shape. Same probe pattern as Slice 4.1 v2 +
// Slice 1h R4 rehearsals.
//
// Assertions:
//   R5R-01 · migration applies cleanly under NOSUPERUSER probe
//   R5R-02 · post-apply · persist_to_food_business body contains
//            extensions.digest, v_wi_row.city_slug, city_catalogue reference,
//            and NO hardcoded 'Yogyakarta' in INSERT VALUES
//   R5R-03 · persister has SELECT on city_catalogue (R5 grant)
//   R5R-04 · wp_food_business_city_catalogue_select policy exists (R5 policy)
//   R5R-05 · persister runtime state · SECDEF + owner + hardened search_path
//            + PUBLIC EXECUTE revoked + no CREATE on schema

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const __dirname = dirname(fileURLToPath(import.meta.url));
const R5_MIGRATION_PATH = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice1h_r5_multi_city_persister.sql");

let pool;
let probePool;

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });

  // Ensure probe role exists (same shape as prior R4/S41 rehearsals)
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

function loadR5() { return readFileSync(R5_MIGRATION_PATH, "utf8"); }

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

describe("Slice 1h R5 · full-migration rehearsal under production-shape probe", () => {
  it("R5R-01 · R5 migration applies cleanly under NOSUPERUSER probe", async () => {
    const out = await rehearse(loadR5());
    expect(out.ok, out.error || "expected success").toBe(true);
  }, 30000);

  it("R5R-02 · persister body has extensions.digest + v_wi_row.city_slug + city_catalogue · NO hardcoded 'Yogyakarta' in INSERT", async () => {
    const r = await pool.query(`
      SELECT
        pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext,
        pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\('     AS has_pub,
        pg_get_functiondef(oid) ~ 'v_wi_row\\.city_slug'       AS has_city_slug,
        pg_get_functiondef(oid) ~ 'nex_workforce\\.city_catalogue' AS has_cc,
        pg_get_functiondef(oid) ~ E'VALUES[^;]*''Yogyakarta''' AS has_hardcoded
      FROM pg_proc
      WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business'
    `);
    expect(r.rows[0].has_ext).toBe(true);
    expect(r.rows[0].has_pub).toBe(false);
    expect(r.rows[0].has_city_slug).toBe(true);
    expect(r.rows[0].has_cc).toBe(true);
    expect(r.rows[0].has_hardcoded).toBe(false);
  });

  it("R5R-03 · persister has SELECT on city_catalogue (R5 grant)", async () => {
    const r = await pool.query(`SELECT has_table_privilege('nex_workforce_persister_food_business', 'nex_workforce.city_catalogue', 'SELECT') AS granted`);
    expect(r.rows[0].granted).toBe(true);
  });

  it("R5R-04 · wp_food_business_city_catalogue_select policy exists", async () => {
    const r = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_policy
         WHERE polrelid='nex_workforce.city_catalogue'::regclass
           AND polname='wp_food_business_city_catalogue_select'
      ) AS exists
    `);
    expect(r.rows[0].exists).toBe(true);
  });

  it("R5R-05 · persister runtime state · SECDEF + owner + hardened search_path + no PUBLIC EXECUTE + no CREATE on schema", async () => {
    const r = await pool.query(`
      SELECT
        p.prosecdef,
        (SELECT rolname FROM pg_roles WHERE oid=p.proowner) AS owner,
        p.proconfig::text AS proconfig,
        NOT EXISTS (
          SELECT 1 FROM (
            SELECT (aclexplode(proacl)).* FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace
             WHERE n.nspname='nex_workforce' AND p2.proname='persist_to_food_business'
          ) acl WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
        ) AS pub_revoked,
        NOT has_schema_privilege('nex_workforce_persister_food_business', 'nex_workforce', 'CREATE') AS no_create
      FROM pg_proc p
      WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business'
    `);
    expect(r.rows[0].prosecdef).toBe(true);
    expect(r.rows[0].owner).toBe("nex_workforce_persister_food_business");
    expect(r.rows[0].proconfig).toContain("search_path=pg_catalog, pg_temp");
    expect(r.rows[0].proconfig).not.toMatch(/\bpublic\b/);
    expect(r.rows[0].pub_revoked).toBe(true);
    expect(r.rows[0].no_create).toBe(true);
  });
});
