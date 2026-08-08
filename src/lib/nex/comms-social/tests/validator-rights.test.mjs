#!/usr/bin/env node
// validator-rights.test.mjs · adversarial re-check semantics
//
//   VR1 · Rights stage passes when all source_refs still eligible
//   VR2 · Source deleted between generation and validation → reject
//   VR3 · Source flipped to rights_status='unknown' → reject
//   VR4 · Source flipped to active=FALSE → reject
//   VR5 · Source expires_at flipped to past → reject
//   VR6 · Source contains_identifiable_persons=TRUE with no release → reject
//   VR7 · Missing source_refs entirely → fail_closed

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

async function tx(client, fn) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    const r = await fn();
    await client.query("COMMIT");
    return r;
  } catch (e) { await client.query("ROLLBACK"); throw e; }
}

async function seedTenant(client) {
  const tenant = randomUuid();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1, 'trade', $2, 'VR')`,
      [tenant, `vr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, tone: "friendly" }),
  });
  return tenant;
}

async function makeDraft(tenant, sourceRightsStatus = "owned") {
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, kind: "business_profile", slug: "primary", content: { name: "T" }, rights_status: sourceRightsStatus }),
  });
  const t = await api(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug: `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind: "project",
      body: "Hi from {{name}}",
      variable_slots: [{ name: "name", source_kind: "business_profile", source_path: "name", required: true, claim_class: "factual" }],
    }),
  });
  const g = await api(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id: t.body?.template?.template_id, platform: "simulator", created_by: "vr" }),
  });
  return g.body?.draft;
}

async function validate(tenant, draftId) {
  const v = await api(`${base}/api/nex/comms-social/content/validate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, draft_id: draftId }),
  });
  return v.body?.run;
}

async function main() {
  process.stdout.write("validator-rights.test.mjs\n");
  const h = await api(`${base}/api/nex/predictive/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }
  const client = await pool.connect();

  // VR1
  {
    const tenant = await seedTenant(client);
    const draft = await makeDraft(tenant);
    const run = await validate(tenant, draft.draft_id);
    const rightsStage = run?.stages?.find(s => s.stage === "rights");
    record("VR1 all-eligible sources → rights pass", rightsStage?.outcome === "pass", `outcome=${rightsStage?.outcome}`);
  }

  // VR2 · source deleted between generation and validation
  {
    const tenant = await seedTenant(client);
    const draft = await makeDraft(tenant);
    // Delete the source
    await tx(client, async () => {
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(`DELETE FROM nex.social_content_sources WHERE tenant_id = $1`, [tenant]);
    });
    const run = await validate(tenant, draft.draft_id);
    const rightsStage = run?.stages?.find(s => s.stage === "rights");
    const missingCode = rightsStage?.rejections?.[0]?.code;
    record("VR2 source deleted → rights_source_missing", rightsStage?.outcome === "reject" && missingCode === "rights_source_missing", `code=${missingCode}`);
  }

  // VR3 · rights_status flipped to unknown
  {
    const tenant = await seedTenant(client);
    const draft = await makeDraft(tenant);
    await tx(client, async () => {
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(`UPDATE nex.social_content_sources SET rights_status='unknown' WHERE tenant_id = $1`, [tenant]);
    });
    const run = await validate(tenant, draft.draft_id);
    const stage = run?.stages?.find(s => s.stage === "rights");
    const code = stage?.rejections?.[0]?.code;
    record("VR3 rights flipped to unknown → rights_source_ineligible", stage?.outcome === "reject" && code === "rights_source_ineligible", `code=${code}`);
  }

  // VR4 · active=FALSE
  {
    const tenant = await seedTenant(client);
    const draft = await makeDraft(tenant);
    await tx(client, async () => {
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(`UPDATE nex.social_content_sources SET active=FALSE WHERE tenant_id = $1`, [tenant]);
    });
    const run = await validate(tenant, draft.draft_id);
    const stage = run?.stages?.find(s => s.stage === "rights");
    const code = stage?.rejections?.[0]?.code;
    record("VR4 active=false → rights_source_inactive", stage?.outcome === "reject" && code === "rights_source_inactive", `code=${code}`);
  }

  // VR5 · expires_at flipped to past
  {
    const tenant = await seedTenant(client);
    const draft = await makeDraft(tenant, "licensed_with_expiry");
    // Set expires_at into the past
    await tx(client, async () => {
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(`UPDATE nex.social_content_sources SET expires_at = NOW() - INTERVAL '1 day' WHERE tenant_id = $1`, [tenant]);
    });
    const run = await validate(tenant, draft.draft_id);
    const stage = run?.stages?.find(s => s.stage === "rights");
    const code = stage?.rejections?.[0]?.code;
    record("VR5 expired → rights_source_expired", stage?.outcome === "reject" && code === "rights_source_expired", `code=${code}`);
  }

  // VR6 · PII flag set without release
  {
    const tenant = await seedTenant(client);
    const draft = await makeDraft(tenant);
    await tx(client, async () => {
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      await client.query(`UPDATE nex.social_content_sources SET contains_identifiable_persons=TRUE WHERE tenant_id = $1`, [tenant]);
    });
    const run = await validate(tenant, draft.draft_id);
    const stage = run?.stages?.find(s => s.stage === "rights");
    const code = stage?.rejections?.[0]?.code;
    record("VR6 PII without release → rights_pii_no_release", stage?.outcome === "reject" && code === "rights_pii_no_release", `code=${code}`);
  }

  // VR7 · missing source_refs entirely (build subject with none) → fail_closed
  {
    const tenant = await seedTenant(client);
    const ad_hoc = {
      tenant_id: tenant, draft_id: null, platform: "simulator",
      caption: "hello", hashtags: [], cta: null, source_refs: [], provenance: {}, claims: [],
    };
    const v = await api(`${base}/api/nex/comms-social/content/validate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, subject: ad_hoc }),
    });
    const stage = v.body?.run?.stages?.find(s => s.stage === "rights");
    record("VR7 zero source_refs → rights fail_closed", stage?.outcome === "fail_closed" && stage?.failed_closed_reason?.includes("no source_refs"), `outcome=${stage?.outcome} reason=${stage?.failed_closed_reason}`);
  }

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
