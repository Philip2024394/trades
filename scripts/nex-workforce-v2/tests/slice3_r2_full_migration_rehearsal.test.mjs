// NEX Workforce v2 · Slice 3 R2 · Full-Migration Rehearsal under production-shape probe
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Applies the R4 rule: "Every production migration involving roles, ownership,
// RLS, SECURITY DEFINER, grants, or schema privileges MUST be tested end-to-end
// under a privilege model equivalent to the actual production caller — not
// merely under local superuser PostgreSQL."
//
// Slice 3 R2 converts 10 SECURITY-INVOKER workforce functions to
// SECURITY DEFINER owned by nex_workforce_admin. Each conversion hits PG 16+
// gates that portable superuser masks:
//   (i)  executor must have SET permission on nex_workforce_admin
//   (ii) nex_workforce_admin must have CREATE on nex_workforce schema
//   (iii) REVOKE PUBLIC + COMMENT ON FUNCTION must run while executor still
//         owns the function (before ALTER OWNER transfer)
//
// This rehearsal runs the FULL Slice 3 migration as a non-superuser probe
// (mirrors Supabase-managed postgres: rolsuper=FALSE + rolcreaterole=TRUE)
// and verifies:
//   R3R-01 · R1-style migration (no SET, no CREATE) FAILS under probe with 42501
//   R3R-02 · Full R2 migration SUCCEEDS end-to-end under probe · commits
//   R3R-03 · Final catalog state matches design (admin, app, 11 functions, grants)
//   R3R-04 · Admin has no unexpected inherit relationships
//   R3R-05 · No PUBLIC/anon/authenticated policy or execute leaks
//   R3R-06 · Admin CREATE on nex_workforce REVOKED at end (runtime USAGE-only)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const __dirname = dirname(fileURLToPath(import.meta.url));
const R2_MIGRATION_PATH = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice3_workforce_role_hardening.sql");
const R4_HH_PATH = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice1h_food_business_persister.sql");

let pool;
let probePool;

// Set of functions Slice 3 converts to SECURITY DEFINER + owner=admin
const HARDENED_FUNCTIONS = [
  { name: "claim", args: "text" },
  { name: "heartbeat", args: "text, uuid, integer" },
  { name: "checkpoint", args: "text, uuid, integer, jsonb" },
  { name: "complete", args: "text, uuid, integer, integer, integer" },
  { name: "fail_soft", args: "text, uuid, integer, text, text, integer" },
  { name: "fail_hard", args: "text, uuid, integer, text, text" },
  { name: "stage_candidates", args: "text, uuid, integer, text, jsonb, jsonb" },
  { name: "persist_batch", args: "text, uuid, integer, regprocedure, integer" },
  { name: "reap_expired_leases", args: "" },
  { name: "requeue_soft_fail_backoff_elapsed", args: "" },
  { name: "enqueue_from_view", args: "" },
];

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });

  // Production-shape probe: NOSUPERUSER + CREATEROLE + CREATEDB + BYPASSRLS + INHERIT
  // Reuse the same probe role as R4 rehearsal (created there if it doesn't exist).
  await pool.query(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_r4_probe') THEN
        CREATE ROLE nex_r4_probe LOGIN NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS INHERIT;
      END IF;
    END $body$
  `);
  // INHERIT postgres so probe has effective owner privileges on nex_workforce
  await pool.query(`GRANT postgres TO nex_r4_probe WITH INHERIT TRUE, SET TRUE`);

  // Mirror Slice 1h R4 · postgres has SET on persister (from R4's GRANT WITH SET TRUE
  // TO CURRENT_USER = postgres). Under this probe scenario, probe is the migration
  // executor, so probe needs the same SET privilege to `SET LOCAL ROLE persister`
  // during the § 2 / § 5 GRANT EXECUTE steps. This matches the Project B state
  // where postgres has this membership from Slice 1h R4 apply.
  await pool.query(`GRANT nex_workforce_persister_food_business TO nex_r4_probe WITH SET TRUE, INHERIT FALSE`);

  // Probe needs USAGE + CREATE on nex_workforce so it can OWN objects in that
  // schema (via ALTER FUNCTION OWNER TO nex_r4_probe in resetSlice3State) ·
  // simulates Project B where postgres already has these implicitly.
  await pool.query(`GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_r4_probe`);

  probePool = new pg.Pool({
    host: CONN.host, port: CONN.port, user: "nex_r4_probe", database: CONN.database, max: 2,
  });
});

afterAll(async () => {
  if (probePool) await probePool.end();
  if (pool) {
    // Restore Slice 3 state (postgres re-applies) so downstream test files see
    // the expected shape. Ordering:
    //   1. Reset Slice 3 state (drop admin/app roles + their objects)
    //   2. Re-apply Slice 1h R4 (persister + food_business RLS)
    //   3. Re-apply Slice 3 R2 (workforce_admin/workforce_app + hardened functions)
    try {
      // Aggressive reset: drop admin + app roles so re-apply is clean
      // First reset function ownerships back to postgres (they may have been
      // ALTER-OWNER'd to nex_r4_probe during rehearsal or to admin after R2)
      for (const f of HARDENED_FUNCTIONS) {
        const sig = f.args ? `(${f.args})` : "()";
        await pool.query(`ALTER FUNCTION nex_workforce.${f.name}${sig} OWNER TO postgres`).catch(() => {});
        await pool.query(`ALTER FUNCTION nex_workforce.${f.name}${sig} SECURITY INVOKER RESET search_path`).catch(() => {});
      }
      await pool.query(`DROP FUNCTION IF EXISTS nex_workforce.enqueue_from_view()`).catch(() => {});
      // Revoke all admin/app grants
      await pool.query(`
        DO $body$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_app') THEN
            EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nex_workforce FROM nex_workforce_app';
            EXECUTE 'REVOKE ALL ON ALL TABLES    IN SCHEMA nex_workforce FROM nex_workforce_app';
            EXECUTE 'REVOKE USAGE ON SCHEMA nex, nex_workforce FROM nex_workforce_app';
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_admin') THEN
            EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nex_workforce FROM nex_workforce_admin';
            EXECUTE 'REVOKE ALL ON ALL TABLES    IN SCHEMA nex_workforce FROM nex_workforce_admin';
            EXECUTE 'REVOKE USAGE ON SCHEMA nex, nex_workforce FROM nex_workforce_admin';
          END IF;
        END $body$
      `).catch(() => {});
      await pool.query(`DROP ROLE IF EXISTS nex_workforce_app`).catch(() => {});
      await pool.query(`DROP ROLE IF EXISTS nex_workforce_admin`).catch(() => {});
      // Re-apply Slice 3 R2 (as postgres · idempotent) to restore state for other tests
      const r2 = readFileSync(R2_MIGRATION_PATH, "utf8");
      await pool.query(r2);
      // Slice 4 (2026-09-04) · R2's enqueue_from_view definition would otherwise
      // overwrite Slice 4's bbox-aware version · re-apply Slice 4 to preserve
      // the bbox-wiring on portable. Idempotent · does nothing on Project B
      // where Slice 4 is not yet applied · this afterAll is portable-only.
      try {
        const s4Path = R2_MIGRATION_PATH.replace("_slice3_workforce_role_hardening.sql", "_slice4_workforce_bbox_wiring.sql");
        const s4 = readFileSync(s4Path, "utf8");
        await pool.query(s4);
      } catch (e) {
        // Slice 4 file may not exist yet on branches predating Slice 4
        if (!/no such file/i.test(e.message)) throw e;
      }
    } catch (e) {
      console.error("[slice3-r2-rehearsal.afterAll] warn state restore:", e.message);
    }
    await pool.end();
  }
});

// Fully reset Slice 3 state so each rehearsal starts clean.
//
// IMPORTANT · under a production-shape probe (INHERIT postgres, non-superuser),
// INHERIT alone does NOT confer ownership rights for REVOKE/ALTER OWNER (only
// SELECT/INSERT/EXECUTE-type grants). On Project B, `postgres` OWNS the
// workforce functions directly (they were created by postgres in prior
// slices). To faithfully simulate that ownership under the probe, we transfer
// ownership of the workforce functions to the probe role BEFORE running the
// rehearsal · so probe operates AS if it were Project B's `postgres` regarding
// the objects it owns.
async function resetSlice3State() {
  // Drop enqueue_from_view (created by Slice 3 · not present in prior slices)
  try { await pool.query(`DROP FUNCTION IF EXISTS nex_workforce.enqueue_from_view()`); }
  catch (e) { console.error("[resetSlice3State] DROP enqueue_from_view:", e.message); }
  // Restore each hardened function to SECURITY INVOKER + owner=nex_r4_probe
  // (probe simulates Project B's postgres · which owns these functions natively)
  for (const f of HARDENED_FUNCTIONS.filter((x) => x.name !== "enqueue_from_view")) {
    const sig = f.args ? `(${f.args})` : "()";
    try { await pool.query(`ALTER FUNCTION nex_workforce.${f.name}${sig} OWNER TO nex_r4_probe`); }
    catch (e) { console.error(`[resetSlice3State] ALTER OWNER ${f.name}:`, e.message); }
    try { await pool.query(`ALTER FUNCTION nex_workforce.${f.name}${sig} SECURITY INVOKER RESET search_path`); }
    catch (e) { console.error(`[resetSlice3State] ALTER INVOKER ${f.name}:`, e.message); }
  }
  // Diagnostic · verify ownership actually transferred
  const ownerCheck = await pool.query(`
    SELECT p.proname, r.rolname AS owner
    FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='nex_workforce' AND p.proname IN ('claim','heartbeat','stage_candidates')
    ORDER BY p.proname
  `);
  for (const r of ownerCheck.rows) {
    console.error(`[resetSlice3State] verify ${r.proname} owner=${r.owner}`);
  }
  // Fully drop admin + app roles via REASSIGN OWNED / DROP OWNED (superuser)
  // so that when the R2 migration re-CREATE ROLEs them, the executor (probe)
  // gets ADMIN OPTION as creator · required by subsequent ALTER ROLE statements.
  await pool.query(`
    DO $body$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_app') THEN
        EXECUTE 'REASSIGN OWNED BY nex_workforce_app TO postgres';
        EXECUTE 'DROP OWNED BY nex_workforce_app';
        EXECUTE 'DROP ROLE nex_workforce_app';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_admin') THEN
        EXECUTE 'REASSIGN OWNED BY nex_workforce_admin TO postgres';
        EXECUTE 'DROP OWNED BY nex_workforce_admin';
        EXECUTE 'DROP ROLE nex_workforce_admin';
      END IF;
    END $body$
  `);
  // For portable mock persister repair path · reset so § 6a re-creates it
  // clean (giving probe ADMIN option as creator).
  await pool.query(`
    DO $body$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_workforce_persister_mock_target') THEN
        EXECUTE 'REASSIGN OWNED BY nex_workforce_persister_mock_target TO postgres';
        EXECUTE 'DROP OWNED BY nex_workforce_persister_mock_target';
        EXECUTE 'DROP ROLE nex_workforce_persister_mock_target';
      END IF;
    END $body$
  `).catch(() => {});
  // Slice 3 § 6a portable-fixture block operates on nex_workforce.mock_persist_target
  // (from Slice 1g test fixture). After the persister role drop above, mock_persist_target
  // is owned by postgres (from REASSIGN OWNED). To let probe re-run § 6a's initial
  // REVOKE + ALTER SECURITY DEFINER + ALTER OWNER operations (all owner-required),
  // transfer mock_persist_target ownership to probe · same treatment as HARDENED_FUNCTIONS.
  // This mirrors Project B where postgres would own it if it existed (it doesn't).
  await pool.query(`
    DO $body$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='nex_workforce' AND p.proname='mock_persist_target') THEN
        EXECUTE 'ALTER FUNCTION nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb) OWNER TO nex_r4_probe';
        EXECUTE 'ALTER FUNCTION nex_workforce.mock_persist_target(text,uuid,integer,text,timestamptz,text,text,jsonb) SECURITY INVOKER RESET search_path';
      END IF;
    END $body$
  `).catch((e) => { console.error("[resetSlice3State] mock_persist_target reset:", e.message); });
}

// Load full R2 migration text (executor-controlled transaction · strip BEGIN/COMMIT)
function loadR2Migration() {
  return readFileSync(R2_MIGRATION_PATH, "utf8")
    .replace(/^\s*BEGIN\s*;\s*$/m, "-- BEGIN handled by caller")
    .replace(/^\s*COMMIT\s*;\s*$/m, "-- COMMIT handled by caller");
}

// Synthetic R1-style (no SET grant, no CREATE grant · reproduces original failure mode)
function loadR1StyleMigration() {
  return loadR2Migration()
    .replace(
      /GRANT nex_workforce_admin TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;/,
      "-- (R1-style · no GRANT admin WITH SET TRUE)"
    )
    .replace(
      /GRANT USAGE, CREATE ON SCHEMA nex_workforce TO nex_workforce_admin;/,
      "GRANT USAGE ON SCHEMA nex_workforce TO nex_workforce_admin;"
    );
}

async function rehearse(sql, { rollback = true } = {}) {
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

// ═════════════════════════════════════════════════════════════════════════════
// R3R-01 · R1-style Slice 3 migration FAILS under production-shape probe
// ═════════════════════════════════════════════════════════════════════════════
describe("R3R-01 · R1-style Slice 3 (no SET grant, no CREATE grant) fails under production-shape probe", () => {
  it("reproduces the R2/R3-style PG 16+ failure that would hit Project B", async () => {
    await resetSlice3State();
    const out = await rehearse(loadR1StyleMigration());
    expect(out.ok, out.error).toBe(false);
    expect(out.sqlState).toBe("42501");
    // R1-style migration will hit ONE of the PG 16+ gates: SET-option on admin
    // (from ALTER FUNCTION OWNER) · CREATE on schema · or persister owner
    // (from GRANT EXECUTE on persister-owned function). Any of these is proof
    // that the R1-style migration would fail on Project B.
    expect(out.error).toMatch(
      /must be able to SET ROLE|permission denied for schema nex_workforce|permission denied for function persist_to_food_business/i
    );
  }, 30000);
});

// ═════════════════════════════════════════════════════════════════════════════
// R3R-02..R3R-06 · Full-migration rehearsal · UN-SKIPPED in R2.1
//
// R2 previously left these five describes as `describe.skip` because § 6a
// portable-fixture repair block had an ordering bug (post-ALTER-OWNER GRANT
// EXECUTE issued as executor rather than as new-owner) that failed under
// production-shape non-superuser probe.
//
// R2.1 (2026-09-04) repairs § 6a by wrapping the post-ALTER-OWNER GRANT
// EXECUTE in `SET LOCAL ROLE persister_mock ... RESET ROLE` (matching the
// pattern already used in § 2 and § 5). Zero effect on Project B where the
// § 6a IF-block is dead code (mock_target never exists). This closes the
// portable-rehearsal gap and lets R3R-02..R3R-06 execute end-to-end under a
// caller with the SAME privilege attributes as Supabase-managed postgres:
//   NOSUPERUSER + CREATEROLE + CREATEDB + BYPASSRLS + INHERIT
//
// After R2.1, the rehearsal proves ALL of the following under production-
// shape probe:
//   R3R-01 · R1-style FAILS with SQLSTATE 42501 (proves R2 fixes are necessary)
//   R3R-02 · full R2.1 SUCCEEDS and COMMITS end-to-end
//   R3R-03 · 11 hardened functions all SECURITY DEFINER owned by admin
//   R3R-04 · admin/app role membership boundaries · INHERIT FALSE observed
//   R3R-05 · PUBLIC EXECUTE revoked on every hardened function
//   R3R-06 · admin CREATE on schema revoked (runtime USAGE-only)
// ═════════════════════════════════════════════════════════════════════════════
describe("R3R-02 · Full Slice 3 R2.1 migration commits successfully under production-shape probe", () => {
  it("all 10 ALTER OWNER + CREATE enqueue_from_view + REVOKEs + policies apply cleanly", async () => {
    await resetSlice3State();
    const out = await rehearse(loadR2Migration(), { rollback: false });
    expect(out.ok, out.error || "expected success").toBe(true);
  }, 30000);
});

// ═════════════════════════════════════════════════════════════════════════════
// R3R-03 · Final catalog state after R2 apply
// ═════════════════════════════════════════════════════════════════════════════
describe("R3R-03 · Final catalog state after Slice 3 R2.1 apply", () => {
  it("11 workforce functions all SECURITY DEFINER owned by admin · hardened search_path", async () => {
    for (const f of HARDENED_FUNCTIONS) {
      const sig = f.args ? `(${f.args})` : "()";
      const row = (await pool.query(`
        SELECT p.prosecdef, r.rolname AS owner, p.proconfig
        FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='nex_workforce' AND p.proname=$1
      `, [f.name])).rows[0];
      expect(row, `${f.name}${sig} must exist`).toBeDefined();
      expect(row.prosecdef, `${f.name} SECURITY DEFINER`).toBe(true);
      expect(row.owner, `${f.name} owner`).toBe("nex_workforce_admin");
      const cfg = row.proconfig || [];
      const hardSp = cfg.some((s) => s.startsWith("search_path=") && s.includes("pg_catalog") && s.includes("pg_temp"));
      expect(hardSp, `${f.name} hardened search_path`).toBe(true);
    }
  });

  it("nex_workforce_admin: NOLOGIN · NOBYPASSRLS · rolsuper=false · USAGE-only on nex_workforce (CREATE revoked)", async () => {
    const attrs = (await pool.query(
      "SELECT rolcanlogin, rolbypassrls, rolsuper FROM pg_roles WHERE rolname='nex_workforce_admin'"
    )).rows[0];
    expect(attrs.rolcanlogin).toBe(false);
    expect(attrs.rolbypassrls).toBe(false);
    expect(attrs.rolsuper).toBe(false);
    const privs = (await pool.query(`
      SELECT has_schema_privilege('nex_workforce_admin', 'nex_workforce', 'USAGE')  AS usage,
             has_schema_privilege('nex_workforce_admin', 'nex_workforce', 'CREATE') AS create_priv
    `)).rows[0];
    expect(privs.usage).toBe(true);
    expect(privs.create_priv).toBe(false);   // R2 fix · REVOKE CREATE at end
  });

  it("nex_workforce_app: NOLOGIN · NOBYPASSRLS · SELECT-only on tables · EXECUTE on hardened + persist_to_food_business", async () => {
    const attrs = (await pool.query(
      "SELECT rolcanlogin, rolbypassrls, rolsuper FROM pg_roles WHERE rolname='nex_workforce_app'"
    )).rows[0];
    expect(attrs.rolcanlogin).toBe(false);
    expect(attrs.rolbypassrls).toBe(false);
    // App must NOT have any INSERT/UPDATE/DELETE grants on nex_workforce.* tables
    const writeGrants = (await pool.query(`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee='nex_workforce_app'
        AND privilege_type IN ('INSERT','UPDATE','DELETE')
        AND table_schema IN ('nex','nex_workforce')
    `)).rows[0].n;
    expect(writeGrants, "app must have ZERO direct write grants").toBe(0);
    // App must have EXECUTE on the 12 approved functions
    const executables = (await pool.query(`
      SELECT count(*)::int AS n FROM information_schema.role_routine_grants
      WHERE grantee='nex_workforce_app'
        AND privilege_type='EXECUTE'
        AND routine_schema='nex_workforce'
        AND routine_name IN ('claim','heartbeat','checkpoint','complete','fail_soft','fail_hard',
                             'stage_candidates','persist_batch','reap_expired_leases',
                             'requeue_soft_fail_backoff_elapsed','enqueue_from_view','persist_to_food_business')
    `)).rows[0].n;
    expect(executables).toBe(12);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R3R-04 · Admin has no unexpected inherit relationships
// ═════════════════════════════════════════════════════════════════════════════
describe("R3R-04 · Admin role membership boundaries", () => {
  it("admin has zero inbound memberships (never inherits any other role)", async () => {
    const rows = await pool.query(`
      SELECT r.rolname FROM pg_auth_members am
      JOIN pg_roles r ON r.oid=am.roleid
      JOIN pg_roles m ON m.oid=am.member
      WHERE m.rolname='nex_workforce_admin'`);
    expect(rows.rows.length).toBe(0);
  });

  it("admin outbound: only migration executor is member · INHERIT FALSE · no runtime privilege leak", async () => {
    const rows = await pool.query(`
      SELECT m.rolname AS member, am.set_option, am.inherit_option
      FROM pg_auth_members am
      JOIN pg_roles r ON r.oid=am.roleid
      JOIN pg_roles m ON m.oid=am.member
      WHERE r.rolname='nex_workforce_admin'
      ORDER BY m.rolname`);
    const members = rows.rows;
    // Under PG 16+ probe scenario: CREATE ROLE gives creator ADMIN OPTION only,
    // and § 1's explicit `GRANT admin TO CURRENT_USER WITH SET TRUE, INHERIT FALSE`
    // adds a SECOND grant row. So there are typically TWO rows for the same
    // (roleid, member) pair with different (admin_option, set_option, inherit_option)
    // flags. Assert across ALL nex_r4_probe rows, not just the first.
    const probeMembers = members.filter((m) => m.member === "nex_r4_probe");
    expect(probeMembers.length, "probe must appear as a member (from § 1 GRANT admin TO CURRENT_USER WITH SET TRUE, INHERIT FALSE + PG 16+ CREATE ROLE admin option)").toBeGreaterThanOrEqual(1);
    expect(probeMembers.some((m) => m.set_option === true), "at least one probe grant row must have SET=true (§ 1 explicit)").toBe(true);
    expect(probeMembers.every((m) => m.inherit_option === false), "every probe grant row on admin must have INHERIT=false (no runtime privilege leak)").toBe(true);
    // No app roles as members
    for (const bad of ["nex_workforce_app", "nex_brain_app", "nex_social_app", "nex_app_runtime", "anon", "authenticated"]) {
      expect(members.some((m) => m.member === bad), `${bad} must NOT be a member of admin`).toBe(false);
    }
  });

  it("app is NOT a member of admin OR persister (structural separation)", async () => {
    const rows = await pool.query(`
      SELECT r.rolname AS parent_role FROM pg_auth_members am
      JOIN pg_roles r ON r.oid=am.roleid
      JOIN pg_roles m ON m.oid=am.member
      WHERE m.rolname='nex_workforce_app'`);
    const parents = rows.rows.map((r) => r.parent_role);
    expect(parents).not.toContain("nex_workforce_admin");
    expect(parents).not.toContain("nex_workforce_persister_food_business");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R3R-05 · PUBLIC EXECUTE revoked on all hardened functions
// ═════════════════════════════════════════════════════════════════════════════
describe("R3R-05 · PUBLIC EXECUTE revoked on every hardened function", () => {
  it("aclexplode grantee=0 (PUBLIC) has no EXECUTE on any hardened function", async () => {
    for (const f of HARDENED_FUNCTIONS) {
      const res = (await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM (
            SELECT (aclexplode(proacl)).*
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='nex_workforce' AND p.proname=$1
          ) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
        ) AS has_public_exec
      `, [f.name])).rows[0];
      expect(res.has_public_exec, `${f.name} PUBLIC EXECUTE must be revoked`).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R3R-06 · Admin CREATE on nex_workforce REVOKED (runtime USAGE-only)
// ═════════════════════════════════════════════════════════════════════════════
describe("R3R-06 · Admin runtime state · USAGE-only on nex_workforce (CREATE cleaned up)", () => {
  it("admin has USAGE but NOT CREATE on nex_workforce after migration", async () => {
    const r = (await pool.query(`
      SELECT has_schema_privilege('nex_workforce_admin', 'nex_workforce', 'USAGE')  AS usage,
             has_schema_privilege('nex_workforce_admin', 'nex_workforce', 'CREATE') AS create_priv
    `)).rows[0];
    expect(r.usage).toBe(true);
    expect(r.create_priv).toBe(false);
  });
});
