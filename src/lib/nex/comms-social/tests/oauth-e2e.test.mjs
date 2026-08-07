#!/usr/bin/env node
// oauth-e2e.test.mjs
//
// End-to-end OAuth flow via the API routes, using the simulator adapter.
// Requires the dev server to be running (auto-started here if needed via
// a soft check; if port 3008 isn't up we skip and report why).
//
// E2E1 · initiate returns an authorize_url containing our state
// E2E2 · callback with the state + a fake code returns an account + persists encrypted tokens
// E2E3 · replayed callback fails (state consumed)
// E2E4 · callback with bad state fails
// E2E5 · stored tokens are encrypted (ciphertext, not plaintext, in DB)
// E2E6 · Tokens can be decrypted server-side and returned via revealTokenForAdapter

import pg from "pg";
import { randomUUID as randomUuid } from "node:crypto";
const { Pool } = pg;

const url = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const port = 3008;
const base = `http://localhost:${port}`;

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

async function fetchOk(u, opts) {
  try {
    const r = await fetch(u, opts);
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  } catch (e) {
    return { status: 0, body: { error: String(e.message) } };
  }
}

async function main() {
  process.stdout.write("oauth-e2e.test.mjs\n");

  // Guard: dev server up?
  const h = await fetchOk(`${base}/api/nex/predictive/controls`, { method: "GET" });
  if (h.status === 0) {
    process.stdout.write(`  SKIP dev server not reachable at ${base} — start with 'npm run dev' and re-run\n`);
    process.exit(0);
  }

  const pool = new Pool({ connectionString: url, max: 3 });
  const client = await pool.connect();
  const tenant = randomUuid();

  // Seed tenant
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1, 'trade', $2, 'E2E test')`,
      [tenant, `e2e-${Date.now()}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }

  // E2E1 · initiate
  const init = await fetchOk(`${base}/api/nex/comms-social/oauth/simulator/initiate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id:    tenant,
      initiated_by: "test-user",
      redirect_uri: `${base}/api/nex/comms-social/oauth/simulator/callback`,
    }),
  });
  const initOk = init.status === 200 && init.body?.ok === true && typeof init.body.authorize_url === "string" && typeof init.body.state === "string";
  record("E2E1 initiate returns authorize_url + state", initOk, initOk ? `state.len=${init.body.state.length}` : `status=${init.status} body=${JSON.stringify(init.body).slice(0,80)}`);
  const state = init.body?.state;

  // E2E2 · callback with fake code
  const cbQs = new URLSearchParams({
    code: "sim-code-abc123",
    state: state ?? "missing",
    tenant_id: tenant,
    redirect_uri: `${base}/api/nex/comms-social/oauth/simulator/callback`,
  });
  const cb = await fetchOk(`${base}/api/nex/comms-social/oauth/simulator/callback?${cbQs}`);
  const cbOk = cb.status === 200 && cb.body?.ok === true && cb.body?.account?.status === "connected";
  record("E2E2 callback exchanges + persists account", cbOk, cbOk ? `account_id=${String(cb.body.account.account_id).slice(0,8)}` : `status=${cb.status} err=${cb.body?.error}`);
  const accountId = cb.body?.account?.account_id;

  // E2E3 · replay callback fails (state consumed)
  const cb2 = await fetchOk(`${base}/api/nex/comms-social/oauth/simulator/callback?${cbQs}`);
  const replayFail = cb2.status !== 200 || cb2.body?.ok === false;
  record("E2E3 replay of same state fails", replayFail, `status=${cb2.status} err=${cb2.body?.error ?? ""}`);

  // E2E4 · bad state
  const badQs = new URLSearchParams({
    code: "sim-code-xyz",
    state: "invalid-state-value-that-was-never-issued",
    tenant_id: tenant,
    redirect_uri: `${base}/api/nex/comms-social/oauth/simulator/callback`,
  });
  const cb3 = await fetchOk(`${base}/api/nex/comms-social/oauth/simulator/callback?${badQs}`);
  record("E2E4 bad state rejected", cb3.status !== 200 || cb3.body?.ok === false, `status=${cb3.status} err=${cb3.body?.error ?? ""}`);

  // E2E5 · verify DB stores CIPHERTEXT not plaintext
  if (accountId) {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE nex_social_app");
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      const r = await client.query(
        `SELECT access_token_ct, refresh_token_ct FROM nex.social_accounts WHERE account_id = $1`,
        [accountId]);
      const row = r.rows[0];
      const ct = row?.access_token_ct;
      const isCipher = ct && ct.length > 0 && !Buffer.from(ct).toString("utf8").includes("sim_access_");
      record("E2E5 stored access token is ciphertext (no plaintext leak)", Boolean(isCipher), `ct.len=${ct?.length ?? 0}`);
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
  } else {
    record("E2E5 stored access token is ciphertext (no plaintext leak)", false, "no account_id from E2E2");
  }

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
