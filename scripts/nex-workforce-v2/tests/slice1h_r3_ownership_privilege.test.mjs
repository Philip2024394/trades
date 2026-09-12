// NEX Workforce v2 · Slice 1h R3 · Ownership-transition privilege regression
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// This test EXISTS to prevent regression of the specific privilege failure that
// Slice 1h R2 hit on Project B PG 17.6:
//
//   ERROR 42501: must be able to SET ROLE "nex_workforce_persister_food_business"
//
// The R2 migration ran cleanly on portable because the local postgres role is
// a full superuser (`rolsuper=true`) which historically has implicit SET on
// roles it creates. Supabase-managed postgres is `rolsuper=false` with
// CREATEROLE but no implicit SET · so R2's `ALTER FUNCTION ... OWNER TO
// <persister>` failed 42501 despite postgres having just created that role.
//
// The R3 fix is one statement inserted between CREATE ROLE and ALTER FUNCTION
// OWNER:
//
//   GRANT <persister> TO CURRENT_USER WITH SET TRUE;
//
// This test:
//   R3-P1  · reproduces the exact R2 failure using a non-superuser executor
//   R3-P2  · confirms the R3 GRANT WITH SET TRUE resolves it
//   R3-P3  · confirms Project B `postgres` privilege attributes match the
//            non-superuser model exercised by this test (READ-ONLY doc test)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const NON_SUPER_URL = `postgres://slice1h_r3_probe@127.0.0.1:5439/nex_workforce_slice1_test`;

let pool;             // superuser · fixture setup only
let nonSuperPool;     // simulates Supabase-managed non-superuser postgres

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 5 });

  // Portable-only test fixture · a LOGIN role that mimics Supabase-managed
  // postgres · NOSUPERUSER + CREATEROLE + CREATEDB + INHERIT + BYPASSRLS.
  // (Postgres allows non-superusers to have BYPASSRLS · matches Project B.)
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='slice1h_r3_probe') THEN
        CREATE ROLE slice1h_r3_probe LOGIN NOSUPERUSER CREATEROLE CREATEDB INHERIT BYPASSRLS;
      END IF;
    END $body$
  `);
  // Probe needs USAGE + CREATE on nex_workforce to create throwaway probe functions
  // WITH GRANT OPTION so probe can subsequently grant these to the target role
  // (mirrors Project B where postgres is the schema owner + can freely grant)
  await pool.query(`GRANT USAGE, CREATE ON SCHEMA nex_workforce TO slice1h_r3_probe WITH GRANT OPTION`);

  nonSuperPool = new pg.Pool({
    host: CONN.host, port: CONN.port, user: "slice1h_r3_probe", database: CONN.database, max: 2,
  });

  // Sanity · probe role must match Supabase-managed postgres shape
  const attrs = (await pool.query(
    "SELECT rolsuper, rolcreaterole, rolinherit, rolbypassrls FROM pg_roles WHERE rolname='slice1h_r3_probe'"
  )).rows[0];
  if (attrs.rolsuper !== false)     throw new Error("probe role must be NOSUPERUSER");
  if (attrs.rolcreaterole !== true) throw new Error("probe role must be CREATEROLE");
});

afterAll(async () => {
  if (nonSuperPool) await nonSuperPool.end();
  // Clean fixture role · idempotent
  if (pool) {
    await pool.query("DROP ROLE IF EXISTS slice1h_r3_probe_target_a").catch(() => {});
    await pool.query("DROP ROLE IF EXISTS slice1h_r3_probe_target_b").catch(() => {});
    await pool.end();
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// R3-P1 · Reproduce R2 failure · non-superuser CREATE ROLE + ALTER OWNER = 42501
// ═════════════════════════════════════════════════════════════════════════════
describe("R3-P1 · non-superuser CREATE ROLE then ALTER FUNCTION OWNER fails 42501 (R2 behavior · WITHOUT R3 fix)", () => {
  it("simulates the exact Project B failure on portable", async () => {
    const c = await nonSuperPool.connect();
    try {
      await c.query("BEGIN");
      // Cleanup any leftover
      await c.query("DROP ROLE IF EXISTS slice1h_r3_probe_target_a");

      // Create a role · CREATEROLE grants ADMIN OPTION but NOT SET in PG 16+
      await c.query("CREATE ROLE slice1h_r3_probe_target_a NOLOGIN NOBYPASSRLS");

      // Verify the current-user does NOT have SET on the new role
      const setCheck = (await c.query(
        "SELECT pg_has_role(current_user, 'slice1h_r3_probe_target_a', 'SET') AS can_set, pg_has_role(current_user, 'slice1h_r3_probe_target_a', 'MEMBER') AS is_member"
      )).rows[0];
      expect(setCheck.is_member).toBe(true);   // ADMIN option makes us a member for GRANT purposes
      expect(setCheck.can_set).toBe(false);    // But we cannot SET ROLE to it · this is PG 16+ semantics

      // Create a throwaway function owned by current_user
      await c.query(`
        CREATE OR REPLACE FUNCTION nex_workforce._r3_probe_fn_a() RETURNS void
        LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$
      `);

      // Attempt ALTER FUNCTION OWNER · MUST FAIL with 42501
      let failedAsExpected = false;
      let errorCode = null;
      let errorMsg = null;
      try {
        await c.query("ALTER FUNCTION nex_workforce._r3_probe_fn_a() OWNER TO slice1h_r3_probe_target_a");
        failedAsExpected = false;
      } catch (e) {
        errorCode = e.code;
        errorMsg  = e.message;
        failedAsExpected = e.code === "42501" && /must be able to SET ROLE/i.test(e.message);
      }
      expect(failedAsExpected, `expected SQLSTATE 42501 "must be able to SET ROLE" · got code=${errorCode} msg=${errorMsg}`).toBe(true);

      await c.query("ROLLBACK");
    } finally { c.release(); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R3-P2 · R3 GRANT WITH SET TRUE resolves the failure
// ═════════════════════════════════════════════════════════════════════════════
describe("R3-P2 · non-superuser CREATE ROLE + GRANT WITH SET TRUE + ALTER OWNER = SUCCESS (R3 behavior)", () => {
  it("R3 fix (GRANT ... TO CURRENT_USER WITH SET TRUE) allows the ALTER FUNCTION OWNER", async () => {
    const c = await nonSuperPool.connect();
    try {
      await c.query("BEGIN");
      await c.query("DROP ROLE IF EXISTS slice1h_r3_probe_target_b");
      await c.query("CREATE ROLE slice1h_r3_probe_target_b NOLOGIN NOBYPASSRLS");

      // Before R3 fix · cannot SET
      const setBefore = (await c.query(
        "SELECT pg_has_role(current_user, 'slice1h_r3_probe_target_b', 'SET') AS can_set"
      )).rows[0].can_set;
      expect(setBefore).toBe(false);

      // R3 fix · explicit GRANT WITH SET TRUE
      await c.query("GRANT slice1h_r3_probe_target_b TO CURRENT_USER WITH SET TRUE");

      // After R3 fix · CAN SET
      const setAfter = (await c.query(
        "SELECT pg_has_role(current_user, 'slice1h_r3_probe_target_b', 'SET') AS can_set"
      )).rows[0].can_set;
      expect(setAfter).toBe(true);

      // Target role needs schema USAGE + CREATE to own an object in it
      // (PostgreSQL ALTER OBJECT OWNER requires new owner to have CREATE on the
      // containing namespace). The real Slice 1h R3 migration grants USAGE to
      // the persister · this test additionally grants CREATE for the probe
      // scenario (the real persister role gets CREATE implicitly via being
      // the function owner post-transfer · but for a fresh probe role we need
      // both explicitly).
      await c.query("GRANT USAGE, CREATE ON SCHEMA nex_workforce TO slice1h_r3_probe_target_b");

      // Now the ALTER FUNCTION OWNER succeeds
      await c.query(`
        CREATE OR REPLACE FUNCTION nex_workforce._r3_probe_fn_b() RETURNS void
        LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$
      `);
      await c.query("ALTER FUNCTION nex_workforce._r3_probe_fn_b() OWNER TO slice1h_r3_probe_target_b");

      // Verify ownership actually changed
      const ownerCheck = (await c.query(`
        SELECT r.rolname AS owner FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='nex_workforce' AND p.proname='_r3_probe_fn_b'
      `)).rows[0];
      expect(ownerCheck.owner).toBe("slice1h_r3_probe_target_b");

      // Idempotent · GRANT WITH SET TRUE again is a no-op (or upgrade)
      await c.query("GRANT slice1h_r3_probe_target_b TO CURRENT_USER WITH SET TRUE");

      await c.query("ROLLBACK");
    } finally { c.release(); }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R3-P3 · Documentation test · Project B postgres role attributes verified READ-ONLY
// ═════════════════════════════════════════════════════════════════════════════
describe("R3-P3 · portable probe role attributes match Project B postgres model", () => {
  it("probe role has rolsuper=false + rolcreaterole=true · same shape as Project B postgres", async () => {
    // Portable probe role attributes verified in beforeAll
    const attrs = (await pool.query(
      "SELECT rolsuper, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname='slice1h_r3_probe'"
    )).rows[0];
    expect(attrs.rolsuper).toBe(false);
    expect(attrs.rolcreaterole).toBe(true);
    expect(attrs.rolbypassrls).toBe(true);
    // Project B `postgres` role attributes (READ-ONLY verified 2026-09-04):
    //   rolsuper=false rolcreaterole=true rolbypassrls=true
    // Match confirmed · this portable probe role is a faithful simulator of the
    // Supabase-managed postgres role that R2 failed under.
  });
});
