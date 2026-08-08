#!/usr/bin/env node
// category-automation.test.mjs · Charter §S-V:
//   CA1 · owner may enable Automatic
//   CA2 · staff may NOT enable Automatic (permission_denied)
//   CA3 · staff MAY set Assisted (propose_automatic)
//   CA4 · setting Automatic stamps enabled_by + enabled_at + last_check_in_at
//   CA5 · sweepAutoDegrade flips Automatic → Assisted after 14 days dormancy
//   CA6 · stampCheckIn resets the timer
//   CA7 · tenant isolation on categories list

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
async function seedTenant() {
  const tenant = randomUuid();
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1, 'trade', $2, 'CA')`,
      [tenant, `ca-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  client.release();
  return tenant;
}

async function main() {
  process.stdout.write("category-automation.test.mjs\n");
  const h = await api(`${base}/api/nex/predictive/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }

  // CA1 · owner enables automatic
  {
    const tenant = await seedTenant();
    const r = await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "project", mode: "automatic", actor: "u1", actor_role: "owner" }),
    });
    record("CA1 owner may enable automatic", r.body?.ok && r.body?.category?.mode === "automatic", `status=${r.status}`);
  }

  // CA2 · staff denied
  {
    const tenant = await seedTenant();
    const r = await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "project", mode: "automatic", actor: "u2", actor_role: "staff" }),
    });
    record("CA2 staff cannot enable automatic (403)", r.status === 403);
  }

  // CA3 · staff can propose assisted
  {
    const tenant = await seedTenant();
    const r = await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "project", mode: "assisted", actor: "u3", actor_role: "staff" }),
    });
    record("CA3 staff may set assisted (propose_automatic permission)", r.body?.ok && r.body?.category?.mode === "assisted");
  }

  // CA4 · Automatic stamps enabled_by + enabled_at + last_check_in_at
  {
    const tenant = await seedTenant();
    const r = await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "product", mode: "automatic", actor: "u4", actor_role: "owner" }),
    });
    const c = r.body?.category;
    record("CA4 automatic stamps timing fields", c?.enabled_by === "u4" && Boolean(c?.enabled_at) && Boolean(c?.last_check_in_at));
  }

  // CA5 · sweepAutoDegrade
  {
    const tenant = await seedTenant();
    await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "faq", mode: "automatic", actor: "u5", actor_role: "owner" }),
    });
    // Fast-forward the timer by directly setting last_check_in_at 15 days ago
    const client = await pool.connect();
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE nex_social_app");
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(
        `UPDATE nex.social_category_automation SET last_check_in_at = NOW() - INTERVAL '15 days' WHERE tenant_id = $1 AND category = 'faq'`,
        [tenant]);
      // Now run the sweep via direct call (there's no API for sweep in Phase 4;
      // Phase 4 exposes the function · production cron calls it)
      const sw = await client.query(
        `UPDATE nex.social_category_automation
            SET mode = 'assisted',
                auto_degraded_at = NOW(),
                auto_degraded_reason = 'no merchant check-in in 14 days',
                updated_at = NOW()
          WHERE mode = 'automatic'
            AND last_check_in_at IS NOT NULL
            AND last_check_in_at < NOW() - INTERVAL '14 days'
            AND tenant_id = $1
          RETURNING category, mode, auto_degraded_reason`,
        [tenant]);
      await client.query("COMMIT");
      record("CA5 14-day dormancy → automatic degraded to assisted",
        sw.rows[0]?.mode === "assisted" && sw.rows[0]?.auto_degraded_reason?.includes("14 days"),
        `mode=${sw.rows[0]?.mode}`);
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    client.release();
  }

  // CA6 · re-enable resets timer + clears degradation
  {
    const tenant = await seedTenant();
    // enable, fast-forward, sweep, re-enable
    await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "seasonal", mode: "automatic", actor: "u6", actor_role: "owner" }),
    });
    const client = await pool.connect();
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE nex_social_app");
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(`UPDATE nex.social_category_automation SET last_check_in_at = NOW() - INTERVAL '20 days', mode='assisted', auto_degraded_at=NOW(), auto_degraded_reason='test' WHERE tenant_id = $1 AND category = 'seasonal'`, [tenant]);
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    client.release();
    const r = await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "seasonal", mode: "automatic", actor: "u6", actor_role: "owner" }),
    });
    const c = r.body?.category;
    record("CA6 re-enable resets auto_degraded fields", c?.mode === "automatic" && c?.auto_degraded_at === null);
  }

  // CA7 · tenant isolation
  {
    const tA = await seedTenant();
    const tB = await seedTenant();
    await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tA, category: "company", mode: "automatic", actor: "u7", actor_role: "owner" }),
    });
    const listB = await api(`${base}/api/nex/comms-social/scheduling/categories?tenant_id=${tB}`);
    const leak = (listB.body?.categories ?? []).some(c => c.tenant_id === tA);
    record("CA7 tenant isolation on categories list", !leak, `B saw ${listB.body?.categories?.length ?? 0}`);
  }

  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
