#!/usr/bin/env node
// validator-platform.test.mjs · Platform stage adversarial:
//   VPL1 · Caption exceeds simulator caps → reject (platform_caption_over_limit)
//   VPL2 · Hashtags exceed simulator caps → reject (platform_hashtags_over_limit)
//   VPL3 · Unknown platform (no adapter) → fail_closed
//   VPL4 · Clean subject within caps → pass

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
async function seedFullTenant() {
  const tenant = randomUuid();
  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1, 'trade', $2, 'VPL')`,
      [tenant, `vpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`]);
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
  // Fetch a source_id so ad_hoc subjects have a real ref
  const c2 = await pool.connect();
  let srcId;
  try {
    await c2.query("BEGIN");
    await c2.query("SET LOCAL ROLE nex_social_app");
    await c2.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
    const r = await c2.query(`SELECT source_id FROM nex.social_content_sources WHERE tenant_id = $1 LIMIT 1`, [tenant]);
    srcId = String(r.rows[0].source_id);
    await c2.query("COMMIT");
  } finally { c2.release(); }
  return { tenant, srcId };
}
async function validate(tenant, subject) {
  const v = await api(`${base}/api/nex/comms-social/content/validate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, subject }),
  });
  return v.body?.run;
}

async function main() {
  process.stdout.write("validator-platform.test.mjs\n");
  const h = await api(`${base}/api/nex/predictive/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }

  // VPL1 · caption exceeds simulator's 2200 char cap
  {
    const { tenant, srcId } = await seedFullTenant();
    const bigCaption = "x".repeat(2201);
    const subject = { tenant_id: tenant, draft_id: null, platform: "simulator", caption: bigCaption, hashtags: [], cta: null, source_refs: [srcId], provenance: {}, claims: [] };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "platform");
    const code = stage?.rejections?.[0]?.code;
    record("VPL1 caption over limit → reject", stage?.outcome === "reject" && code === "platform_caption_over_limit", `code=${code}`);
  }

  // VPL2 · 31 hashtags > 30
  {
    const { tenant, srcId } = await seedFullTenant();
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`);
    const subject = { tenant_id: tenant, draft_id: null, platform: "simulator", caption: "ok", hashtags: tags, cta: null, source_refs: [srcId], provenance: {}, claims: [] };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "platform");
    const code = stage?.rejections?.[0]?.code;
    record("VPL2 hashtags over limit → reject", stage?.outcome === "reject" && code === "platform_hashtags_over_limit", `code=${code}`);
  }

  // VPL3 · unknown platform → fail_closed
  {
    const { tenant, srcId } = await seedFullTenant();
    const subject = { tenant_id: tenant, draft_id: null, platform: "unregistered", caption: "hi", hashtags: [], cta: null, source_refs: [srcId], provenance: {}, claims: [] };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "platform");
    record("VPL3 unknown platform → fail_closed", stage?.outcome === "fail_closed", `outcome=${stage?.outcome}`);
  }

  // VPL4 · clean pass
  {
    const { tenant, srcId } = await seedFullTenant();
    const subject = { tenant_id: tenant, draft_id: null, platform: "simulator", caption: "hi", hashtags: ["#a"], cta: null, source_refs: [srcId], provenance: {}, claims: [] };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "platform");
    record("VPL4 clean subject → platform pass", stage?.outcome === "pass", `outcome=${stage?.outcome}`);
  }

  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
