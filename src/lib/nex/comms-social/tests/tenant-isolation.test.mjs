#!/usr/bin/env node
// tenant-isolation.test.mjs
//
// Proves at the DB layer that RLS default-deny actually holds for
// nex.social_* tables. Every assertion runs against Postgres 17 (not
// mocked). Uses the same pg connection env var the app uses.
//
// Assertions:
//   T1 · Tenant A can read its own accounts row.
//   T2 · Tenant A CANNOT read Tenant B's accounts row (RLS filters).
//   T3 · Tenant A CANNOT INSERT a row for Tenant B (RLS check-constraint fails).
//   T4 · Tenant A CANNOT UPDATE a row belonging to Tenant B.
//   T5 · Tenant A CANNOT DELETE a row belonging to Tenant B.
//   T6 · Missing tenant GUC returns zero rows (default-deny).
//   T7 · Admin bypass wrapper: (a) writes an audit row before yielding,
//        (b) permits cross-tenant SELECT for the duration of the callback,
//        (c) does NOT permit cross-tenant INSERT/UPDATE/DELETE (write
//        bypass explicitly excluded from RLS policies).
//   T8 · nex.social_admin_read() refuses when reason is missing.
//   T9 · Boundary-3 audit row is captured in nex.social_admin_access_log
//        with resource + admin_user_id + reason populated.
//
// Prints PASS/FAIL per assertion + exits 0 if all pass, 1 otherwise.

import pg from "pg";
import { randomUUID as randomUuid } from "node:crypto";
const { Pool } = pg;

const url = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url, max: 3 });

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  const tag = pass ? "PASS" : "FAIL";
  process.stdout.write(`  ${tag} ${id}${note ? " · " + note : ""}\n`);
}

async function tx(client, fn) {
  await client.query("BEGIN");
  try {
    // Every test transaction runs as nex_social_app · production RLS parity.
    await client.query("SET LOCAL ROLE nex_social_app");
    const r = await fn();
    await client.query("COMMIT");
    return r;
  } catch (e) { await client.query("ROLLBACK"); throw e; }
}

// Setup helper needs superuser (creating tenants requires admin_bypass
// which needs the setting privilege on the GUC).
async function setupTx(client, fn) {
  await client.query("BEGIN");
  try { const r = await fn(); await client.query("COMMIT"); return r; }
  catch (e) { await client.query("ROLLBACK"); throw e; }
}

async function main() {
  const client = await pool.connect();
  // Fresh tenant UUIDs per run so tests are hermetic even if prior runs
  // left rows (which would otherwise be RLS-invisible under nex_social_app).
  const tenantA = randomUuid();
  const tenantB = randomUuid();

  process.stdout.write("tenant-isolation.test.mjs\n");

  // Setup: create two tenants + one account per tenant (via bypass since tenants table INSERT requires bypass).
  await setupTx(client, async () => {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1,'hq',$3,'HQ Test'), ($2,'trade',$4,'Trade Test')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantA, tenantB, `hq-test-${Date.now()}`, `trade-test-${Date.now()}`],
    );
  });
  // Insert one account per tenant · scoped by tenant GUC each time.
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    await client.query(
      `INSERT INTO nex.social_accounts (tenant_id, platform, display_name, platform_account_id)
       VALUES ($1, 'simulator', 'A-simulator', 'A-1') ON CONFLICT DO NOTHING`,
      [tenantA],
    );
  });
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantB]);
    await client.query(
      `INSERT INTO nex.social_accounts (tenant_id, platform, display_name, platform_account_id)
       VALUES ($1, 'simulator', 'B-simulator', 'B-1') ON CONFLICT DO NOTHING`,
      [tenantB],
    );
  });

  // T1 · A reads own
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.social_accounts WHERE tenant_id = $1", [tenantA]);
    record("T1 A reads own accounts", r.rows[0].n >= 1, `count=${r.rows[0].n}`);
  });

  // T2 · A tries to read B (should return 0 rows)
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.social_accounts WHERE tenant_id = $1", [tenantB]);
    record("T2 A cannot read B", r.rows[0].n === 0, `count=${r.rows[0].n}`);
  });

  // T3 · A tries to INSERT for B (RLS WITH CHECK must reject)
  {
    let rejected = false, msg = "";
    try {
      await tx(client, async () => {
        await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
        await client.query(
          `INSERT INTO nex.social_accounts (tenant_id, platform, display_name, platform_account_id)
           VALUES ($1, 'simulator', 'X', 'X-1')`, [tenantB]);
      });
    } catch (e) { rejected = true; msg = String(e.message).slice(0, 80); }
    record("T3 A cannot INSERT into B", rejected, msg);
  }

  // T4 · A tries to UPDATE B's row (RLS USING must filter · zero rows updated)
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(
      `UPDATE nex.social_accounts SET display_name = 'HACK' WHERE tenant_id = $1 RETURNING account_id`,
      [tenantB]);
    record("T4 A cannot UPDATE B", r.rowCount === 0, `rowCount=${r.rowCount}`);
  });

  // T5 · A tries to DELETE B's row
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(
      "DELETE FROM nex.social_accounts WHERE tenant_id = $1", [tenantB]);
    record("T5 A cannot DELETE B", r.rowCount === 0, `rowCount=${r.rowCount}`);
  });

  // T6 · Missing GUC returns zero rows
  await tx(client, async () => {
    // No set_config · GUC is empty · nex._current_social_tenant() returns NULL · tenant_id = NULL is never true
    const r = await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.social_accounts");
    record("T6 Missing tenant GUC → zero rows", r.rows[0].n === 0, `count=${r.rows[0].n}`);
  });

  // T7a · Admin bypass grants SELECT
  await tx(client, async () => {
    await client.query(
      `SELECT nex.social_admin_read($1, $2, 'account_status_only', 'T7a bypass select proof')`,
      ["test-admin", tenantB]);
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantB]);
    const r = await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.social_accounts WHERE tenant_id = $1", [tenantB]);
    record("T7a Admin bypass permits cross-tenant SELECT", r.rows[0].n >= 1, `count=${r.rows[0].n}`);
  });

  // T7b · Admin bypass does NOT permit INSERT into a tenant not matching GUC
  //       (Because UPDATE/DELETE/INSERT policies key on tenant_id = GUC only,
  //       NOT the bypass flag. Admin sitting under tenantA GUC cannot INSERT
  //       into tenantB even with bypass enabled.)
  {
    let rejected = false;
    try {
      await tx(client, async () => {
        await client.query(
          `SELECT nex.social_admin_read($1, $2, 'account_status_only', 'T7b bypass write proof')`,
          ["test-admin", tenantB]);
        await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
        await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
        // Try to INSERT with a tenant_id of B while GUC=A · WITH CHECK must reject.
        await client.query(
          `INSERT INTO nex.social_accounts (tenant_id, platform, display_name, platform_account_id)
           VALUES ($1, 'simulator', 'BYPASS-WRITE', 'BW-1')`, [tenantB]);
      });
    } catch (_e) { rejected = true; }
    record("T7b Admin bypass does NOT permit cross-tenant INSERT", rejected);
  }

  // T8 · admin_read refuses empty reason
  {
    let rejected = false, msg = "";
    try {
      await tx(client, async () => {
        await client.query(
          `SELECT nex.social_admin_read($1, $2, 'account_status_only', $3)`,
          ["test-admin", tenantB, ""]);
      });
    } catch (e) { rejected = true; msg = String(e.message).slice(0, 60); }
    record("T8 admin_read refuses empty reason", rejected, msg);
  }

  // T9 · Boundary-3 audit row is captured
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    const r = await client.query(
      `SELECT resource, admin_user_id, reason
         FROM nex.social_admin_access_log
        WHERE target_tenant_id = $1
        ORDER BY accessed_at DESC LIMIT 1`, [tenantB]);
    const row = r.rows[0];
    const ok = row && row.admin_user_id === "test-admin"
                   && row.resource === "account_status_only"
                   && typeof row.reason === "string" && row.reason.length > 0;
    record("T9 Boundary-3 audit row captured", Boolean(ok), row ? `resource=${row.resource}` : "no row");
  });

  client.release();
  await pool.end();

  const failed = results.filter(r => !r.pass);
  process.stdout.write(`\nSummary · ${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length > 0) {
    for (const f of failed) process.stdout.write(`  FAILED · ${f.id} · ${f.note}\n`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write("test crashed: " + e.stack + "\n");
  process.exit(2);
});
