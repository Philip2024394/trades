#!/usr/bin/env node
// validator-brand.test.mjs · Brand stage adversarial:
//   VB1 · Missing brand profile → fail_closed
//   VB2 · Brand forbidden_term appears in caption → reject
//   VB3 · Brand forbidden_term appears only as substring inside a word → NO reject (whole-word only)
//   VB4 · Brand required_hashtag missing → reject
//   VB5 · Brand profile present + no forbidden terms hit + required hashtags present → pass

import pg from "pg";
import { randomUUID as randomUuid } from "node:crypto";
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
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1, 'trade', $2, 'VB')`,
      [tenant, `vb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  client.release();
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, kind: "business_profile", slug: "primary", content: { name: "T" }, rights_status: "owned" }),
  });
  return tenant;
}
async function makeAdHocSubject(tenant, caption, hashtags = []) {
  return {
    tenant_id: tenant, draft_id: null, platform: "simulator",
    caption, hashtags, cta: null,
    // Give it a real source_ref so Rights stage doesn't fail_closed on missing refs.
    source_refs: await getSourceIdFor(tenant), provenance: {}, claims: [],
  };
}
async function getSourceIdFor(tenant) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
    const r = await client.query(`SELECT source_id FROM nex.social_content_sources WHERE tenant_id = $1 LIMIT 1`, [tenant]);
    await client.query("COMMIT");
    return r.rows[0] ? [String(r.rows[0].source_id)] : [];
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
  process.stdout.write("validator-brand.test.mjs\n");
  const h = await api(`${base}/api/nex/predictive/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }

  // VB1 · missing brand profile
  {
    const tenant = await seedTenant();
    // Deliberately no brand profile
    const subject = await makeAdHocSubject(tenant, "hello");
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "brand");
    record("VB1 missing brand profile → fail_closed", stage?.outcome === "fail_closed", `outcome=${stage?.outcome} reason=${stage?.failed_closed_reason}`);
  }

  // VB2 · merchant-specific forbidden term (not on any global list)
  //   Uses "wobbly" — deliberately fabricated · not on the global explicit_reject
  //   or forbidden-claims lists · so only the Brand stage should reject it.
  {
    const tenant = await seedTenant();
    await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, tone: "friendly", forbidden_terms: ["wobbly"] }),
    });
    const subject = await makeAdHocSubject(tenant, "this is a wobbly staircase");
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "brand");
    const code = stage?.rejections?.[0]?.code;
    record("VB2 brand_forbidden_term catches merchant-specific word", stage?.outcome === "reject" && code === "brand_forbidden_term", `code=${code} stages=${run?.stages?.map(s=>s.stage+':'+s.outcome).join(',')}`);
  }

  // VB3 · substring-only should NOT match (whole-word check)
  {
    const tenant = await seedTenant();
    await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, tone: "friendly", forbidden_terms: ["wobbly"] }),
    });
    // "wobblyish" is not the word "wobbly"
    const subject = await makeAdHocSubject(tenant, "this is not wobblyish at all");
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "brand");
    record("VB3 substring-only does NOT match (whole-word)", stage?.outcome !== "reject" || !(stage?.rejections?.some(r => r.code === "brand_forbidden_term")), `outcome=${stage?.outcome}`);
  }

  // VB4 · missing required hashtag
  {
    const tenant = await seedTenant();
    await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, tone: "friendly", required_hashtags: ["#OakwoodStaircases"] }),
    });
    const subject = await makeAdHocSubject(tenant, "clean caption", ["#Nottingham"]);
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "brand");
    const code = stage?.rejections?.[0]?.code;
    record("VB4 missing required hashtag → brand_missing_required_hashtag", stage?.outcome === "reject" && code === "brand_missing_required_hashtag", `code=${code}`);
  }

  // VB5 · clean pass
  {
    const tenant = await seedTenant();
    await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, tone: "friendly", forbidden_terms: [], required_hashtags: [] }),
    });
    const subject = await makeAdHocSubject(tenant, "clean tone caption", []);
    const run = await validate(tenant, subject);
    const stage = run?.stages?.find(s => s.stage === "brand");
    record("VB5 brand pass when nothing violates", stage?.outcome === "pass", `outcome=${stage?.outcome}`);
  }

  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
