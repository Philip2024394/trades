#!/usr/bin/env node
// validator-fact.test.mjs · Fact stage adversarial:
//   VF1 · Grounded caption → fact pass
//   VF2 · Ungrounded hard-block claim → fact reject (fact_hard_blocked)
//   VF3 · Ungrounded review-required claim → fact reject (fact_review_required)
//   VF4 · Green descriptor not on rules → fact pass (not flagged)
//   VF5 · Fact stage does NOT trust the subject's own claim list
//         (subject with empty claims but caption contains "lifetime guarantee" → rejects)

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
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1, 'trade', $2, 'VF')`,
      [tenant, `vf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`]);
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
  return tenant;
}
async function getSourceId(tenant) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
    const r = await client.query(`SELECT source_id FROM nex.social_content_sources WHERE tenant_id = $1 LIMIT 1`, [tenant]);
    await client.query("COMMIT");
    return String(r.rows[0].source_id);
  } finally { client.release(); }
}
async function validate(tenant, subject) {
  const v = await api(`${base}/api/nex/comms-social/content/validate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, subject }),
  });
  return v.body?.run;
}

async function main() {
  process.stdout.write("validator-fact.test.mjs\n");
  const h = await api(`${base}/api/nex/predictive/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }

  // VF1 · grounded caption
  {
    const tenant = await seedTenant();
    const srcId = await getSourceId(tenant);
    const subject = {
      tenant_id: tenant, draft_id: null, platform: "simulator",
      caption: "Nottingham project by Test Co", hashtags: [], cta: null,
      source_refs: [srcId],
      provenance: { name: { variable: "name", source_id: srcId, source_kind: "business_profile", source_path: "name", value: "Nottingham" } },
      claims: [],
    };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "fact");
    record("VF1 grounded caption → fact pass", stage?.outcome === "pass", `outcome=${stage?.outcome}`);
  }

  // VF2 · lifetime guarantee ungrounded → hard_blocked
  {
    const tenant = await seedTenant();
    const srcId = await getSourceId(tenant);
    const subject = {
      tenant_id: tenant, draft_id: null, platform: "simulator",
      caption: "We provide a lifetime guarantee on every staircase.", hashtags: [], cta: null,
      source_refs: [srcId], provenance: {}, claims: [],
    };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "fact");
    const code = stage?.rejections?.[0]?.code;
    record("VF2 ungrounded 'lifetime guarantee' → fact_hard_blocked", stage?.outcome === "reject" && code === "fact_hard_blocked", `code=${code}`);
  }

  // VF3 · award-winning → review_required
  {
    const tenant = await seedTenant();
    const srcId = await getSourceId(tenant);
    const subject = {
      tenant_id: tenant, draft_id: null, platform: "simulator",
      caption: "An award-winning studio in town.", hashtags: [], cta: null,
      source_refs: [srcId], provenance: {}, claims: [],
    };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "fact");
    const code = stage?.rejections?.[0]?.code;
    record("VF3 ungrounded 'award-winning' → fact_review_required", stage?.outcome === "reject" && code === "fact_review_required", `code=${code}`);
  }

  // VF4 · green descriptor not flagged
  {
    const tenant = await seedTenant();
    const srcId = await getSourceId(tenant);
    const subject = {
      tenant_id: tenant, draft_id: null, platform: "simulator",
      caption: "A beautiful modern oak staircase.", hashtags: [], cta: null,
      source_refs: [srcId], provenance: {}, claims: [],
    };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "fact");
    record("VF4 green descriptors do NOT trigger fact rejections", stage?.outcome === "pass", `outcome=${stage?.outcome} rejections=${JSON.stringify(stage?.rejections)}`);
  }

  // VF5 · empty subject.claims does NOT excuse a hard_block in the caption
  {
    const tenant = await seedTenant();
    const srcId = await getSourceId(tenant);
    const subject = {
      tenant_id: tenant, draft_id: null, platform: "simulator",
      caption: "guaranteed for life quality", hashtags: [], cta: null,
      source_refs: [srcId], provenance: {}, claims: [],  // deliberately empty
    };
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "fact");
    record("VF5 fact does NOT trust subject's own claim list · re-classifies", stage?.outcome === "reject", `outcome=${stage?.outcome}`);
  }

  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
