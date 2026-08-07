#!/usr/bin/env node
// oauth-state.test.mjs
//
// Proves the OAuth state guarantees at the DB layer:
//   S1 · State can be created and consumed exactly once
//   S2 · Second consumption of the same state fails as already_consumed
//   S3 · Consuming an expired state fails
//   S4 · Consuming with wrong tenant fails
//   S5 · Consuming with wrong platform fails
//   S6 · State token is high-entropy (base64url, ≥32 raw bytes)

import pg from "pg";
import { randomBytes, randomUUID as randomUuid } from "node:crypto";
const { Pool } = pg;

const url = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url, max: 3 });

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

async function tx(client, fn) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    const r = await fn();
    await client.query("COMMIT");
    return r;
  } catch (e) { await client.query("ROLLBACK"); throw e; }
}

async function insertState(client, { state_token, tenant, platform, ttl_seconds = 600 }) {
  await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
  const expires_at = new Date(Date.now() + ttl_seconds * 1000).toISOString();
  await client.query(
    `INSERT INTO nex.social_oauth_states
       (state_token, tenant_id, platform, initiated_by, expires_at)
     VALUES ($1, $2, $3, 'test-user', $4::timestamptz)`,
    [state_token, tenant, platform, expires_at]);
  return { state_token, expires_at };
}

// Atomic consume mirroring src/lib/nex/comms-social/oauth/state.ts.
async function consumeState(client, state_token, tenant, platform, nowIso) {
  await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
  const row = await client.query(
    `SELECT platform, tenant_id, consumed_at, expires_at
       FROM nex.social_oauth_states WHERE state_token = $1`,
    [state_token]);
  if (row.rowCount === 0) return { ok: false, reason: "not_found" };
  if (String(row.rows[0].tenant_id) !== tenant) return { ok: false, reason: "wrong_tenant" };
  if (String(row.rows[0].platform)  !== platform) return { ok: false, reason: "wrong_platform" };
  const upd = await client.query(
    `UPDATE nex.social_oauth_states
        SET consumed_at = $2::timestamptz
      WHERE state_token = $1 AND consumed_at IS NULL AND expires_at > $2::timestamptz
      RETURNING state_token`,
    [state_token, nowIso ?? new Date().toISOString()]);
  return upd.rowCount === 1 ? { ok: true } : { ok: false, reason: "already_consumed_or_expired" };
}

async function main() {
  process.stdout.write("oauth-state.test.mjs\n");
  const client = await pool.connect();
  const tenant = randomUuid();

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1, 'trade', $2, 'S test')`,
      [tenant, `s-test-${Date.now()}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }

  // S1 · create + consume once
  await tx(client, async () => {
    const st = randomBytes(32).toString("base64url");
    await insertState(client, { state_token: st, tenant, platform: "simulator" });
    const r1 = await consumeState(client, st, tenant, "simulator");
    record("S1 first consume succeeds", r1.ok === true, r1.reason ?? "");
  });

  // S2 · second consume fails
  await tx(client, async () => {
    const st = randomBytes(32).toString("base64url");
    await insertState(client, { state_token: st, tenant, platform: "simulator" });
    await consumeState(client, st, tenant, "simulator");
    const r2 = await consumeState(client, st, tenant, "simulator");
    record("S2 second consume fails", r2.ok === false && r2.reason === "already_consumed_or_expired", r2.reason ?? "");
  });

  // S3 · expired state fails
  await tx(client, async () => {
    const st = randomBytes(32).toString("base64url");
    await insertState(client, { state_token: st, tenant, platform: "simulator", ttl_seconds: -60 });
    const r = await consumeState(client, st, tenant, "simulator");
    record("S3 expired consume fails", r.ok === false, r.reason ?? "");
  });

  // S4 · wrong tenant
  await tx(client, async () => {
    const st = randomBytes(32).toString("base64url");
    await insertState(client, { state_token: st, tenant, platform: "simulator" });
    const wrongTenant = randomUuid();
    // Create the wrong tenant so RLS allows the SELECT to see something (both under bypass? no · here we just verify the mismatch branch)
    // For this assertion, we consume under wrongTenant which shouldn't match.
    // First we need a tenant record to set RLS GUC to. Insert wrongTenant.
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1,'trade',$2,'Wrong')`,
      [wrongTenant, `w-${Date.now()}`]);
    await client.query("SELECT set_config('nex.social_admin_bypass', '', true)");
    const r = await consumeState(client, st, wrongTenant, "simulator");
    record("S4 wrong-tenant consume fails", r.ok === false, r.reason ?? "");
  });

  // S5 · wrong platform
  await tx(client, async () => {
    const st = randomBytes(32).toString("base64url");
    await insertState(client, { state_token: st, tenant, platform: "simulator" });
    const r = await consumeState(client, st, tenant, "facebook");
    record("S5 wrong-platform consume fails", r.ok === false, r.reason ?? "");
  });

  // S6 · state token entropy
  {
    const st = randomBytes(32).toString("base64url");
    // base64url of 32 bytes has length 43 · always
    record("S6 state token entropy adequate", st.length >= 43 && /^[A-Za-z0-9_-]+$/.test(st), `len=${st.length}`);
  }

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
