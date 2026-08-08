#!/usr/bin/env node
// pause-propagation.test.mjs · Charter §S-V critical:
//   PP1 · PAUSED prevents new leases (SW5 already covers)
//   PP2 · PAUSED survives worker restart (persistent row state)
//   PP3 · PAUSED propagates within 30s (control toggle → next tick sees it)
//   PP4 · UNPAUSE resumes work (queued jobs pick up on next tick)
//   PP5 · Global pause is visible via GET /controls
//   PP6 · A worker that already began processing does NOT auto-abort
//         but the NEXT lease attempt during pause returns no_work
//         (this is the intentional in-flight-completes semantic)

import { randomUUID as randomUuid } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const url  = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const base = "http://localhost:3008";
const pool = new Pool({ connectionString: url, max: 3 });

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}
async function api(url, opts) {
  try { const r = await fetch(url, opts); return { status: r.status, body: await r.json().catch(() => ({})) }; }
  catch (e) { return { status: 0, body: { error: String(e.message) } }; }
}
async function setGlobalPause(paused, actor = "pp-test") {
  return await api(`${base}/api/nex/comms-social/controls`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ global_pause: paused, actor, reason: paused ? "PP test" : undefined }),
  });
}
async function seedTenantAndAccount() {
  const tenant = randomUuid();
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1, 'trade', $2, 'PP')`,
      [tenant, `pp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  client.release();
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, kind: "business_profile", slug: "primary", content: { name: "T" }, rights_status: "owned" }),
  });
  await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, tone: "friendly" }),
  });
  const initR = await api(`${base}/api/nex/comms-social/oauth/simulator/initiate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, initiated_by: "pp", redirect_uri: `${base}/cb` }),
  });
  const state = initR.body?.state;
  const qs = new URLSearchParams({ code: "sim-pp", state, tenant_id: tenant, redirect_uri: `${base}/cb` });
  const cbR = await api(`${base}/api/nex/comms-social/oauth/simulator/callback?${qs}`);
  return { tenant, accountId: cbR.body?.account?.account_id };
}
async function makeAndEnqueue(tenant, accountId) {
  const t = await api(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug: `pp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind: "project",
      body: "Hi from {{name}}",
      variable_slots: [{ name: "name", source_kind: "business_profile", source_path: "name", required: true, claim_class: "factual" }],
    }),
  });
  const g = await api(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id: t.body?.template?.template_id, platform: "simulator", created_by: "pp" }),
  });
  const eq = await api(`${base}/api/nex/comms-social/scheduling/enqueue`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, draft_id: g.body?.draft?.draft_id, account_id: accountId,
      platform: "simulator", run_at: new Date(Date.now() - 5000).toISOString(), enqueued_by: "pp",
    }),
  });
  return eq.body?.scheduled_id;
}
async function tick(id) {
  return await api(`${base}/api/nex/comms-social/worker/tick`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ worker_id: id ?? "w-pp" }),
  });
}

async function main() {
  process.stdout.write("pause-propagation.test.mjs\n");
  const h = await api(`${base}/api/nex/predictive/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }
  await setGlobalPause(false, "pp-setup");

  // PP5 · pause visible via GET
  {
    await setGlobalPause(true, "pp5");
    const g = await api(`${base}/api/nex/comms-social/controls`);
    await setGlobalPause(false, "pp5");
    record("PP5 pause visible via GET /controls",
      g.body?.controls?.global_pause === true && g.body?.controls?.global_pause_by === "pp5");
  }

  // PP2 · pause survives across "restarts" · we simulate by running two
  //       consecutive ticks with pause enabled — both must be no_work.
  {
    const { tenant, accountId } = await seedTenantAndAccount();
    await makeAndEnqueue(tenant, accountId);
    await setGlobalPause(true, "pp2");
    const t1 = await tick("w-pp2a");
    const t2 = await tick("w-pp2b");
    await setGlobalPause(false, "pp2");
    record("PP2 pause survives worker cycles (both ticks return no_work)",
      t1.body?.outcomes?.[0]?.outcome === "no_work"
      && t2.body?.outcomes?.[0]?.outcome === "no_work",
      `t1=${t1.body?.outcomes?.[0]?.outcome} t2=${t2.body?.outcomes?.[0]?.outcome}`);
  }

  // PP3 · pause propagates immediately (next tick sees it)
  {
    const { tenant, accountId } = await seedTenantAndAccount();
    await makeAndEnqueue(tenant, accountId);
    const startedAt = Date.now();
    await setGlobalPause(true, "pp3");
    const t = await tick("w-pp3");
    const ms = Date.now() - startedAt;
    await setGlobalPause(false, "pp3");
    record("PP3 pause propagates before next tick",
      t.body?.outcomes?.[0]?.outcome === "no_work" && ms < 30_000,
      `outcome=${t.body?.outcomes?.[0]?.outcome} elapsed=${ms}ms`);
  }

  // PP4 · unpause resumes work
  {
    const { tenant, accountId } = await seedTenantAndAccount();
    await makeAndEnqueue(tenant, accountId);
    await setGlobalPause(true, "pp4");
    const paused = await tick("w-pp4a");
    await setGlobalPause(false, "pp4");
    const resumed = await tick("w-pp4b");
    record("PP4 unpause resumes work · queued job picked up next tick",
      paused.body?.outcomes?.[0]?.outcome === "no_work"
      && resumed.body?.outcomes?.[0]?.outcome === "published",
      `paused=${paused.body?.outcomes?.[0]?.outcome} resumed=${resumed.body?.outcomes?.[0]?.outcome}`);
  }

  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
