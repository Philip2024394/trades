#!/usr/bin/env node
// grounding-validation.test.mjs
//
// Proves the grounding validator:
//   GV1 · Template with only factual variables from valid sources → grounded
//   GV2 · Template body containing a hard-blocked pattern (e.g. "guaranteed for life") → rejected
//   GV3 · Template body containing "the best" superlative → rejected
//   GV4 · Template body containing an explicit-reject descriptor ("premium") → rejected
//   GV5 · Template body containing a review-required pattern (e.g. "award-winning") → rejected
//   GV6 · Draft with rejection carries specific reason code

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
  try {
    const r = await fetch(url, opts);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) { return { status: 0, body: { error: String(e.message) } }; }
}

async function seedTenant(client) {
  const tenant = randomUuid();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1,'trade',$2,'GV test')`, [tenant, `gv-${Date.now()}-${Math.random().toString(36).slice(2,6)}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  // Seed a business_profile via API
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, kind: "business_profile", slug: "primary",
      content: { name: "Test Co", city: "Nottingham" }, rights_status: "owned",
    }),
  });
  return tenant;
}

async function makeTemplate(tenant, slug, body) {
  const t = await api(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug, kind: "project", body,
      variable_slots: [{ name: "name", source_kind: "business_profile", source_path: "name", required: true, claim_class: "factual" }],
    }),
  });
  return t.body?.template?.template_id;
}

async function generate(tenant, template_id) {
  return await api(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id, platform: "instagram", created_by: "gv-test" }),
  });
}

async function main() {
  process.stdout.write("grounding-validation.test.mjs\n");
  const health = await api(`${base}/api/nex/predictive/controls`);
  if (health.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }
  const client = await pool.connect();

  // GV1 · clean template
  {
    const tenant = await seedTenant(client);
    const tid = await makeTemplate(tenant, "clean", "Recent project by {{name}}");
    const g = await generate(tenant, tid);
    record("GV1 clean template → grounded", g.body?.draft?.grounding_state === "grounded", `state=${g.body?.draft?.grounding_state} reasons=${JSON.stringify(g.body?.draft?.rejection_reasons)}`);
  }

  // GV2 · lifetime guarantee hard-block
  {
    const tenant = await seedTenant(client);
    const tid = await makeTemplate(tenant, "guarantee", "{{name}} · lifetime guarantee on every staircase");
    const g = await generate(tenant, tid);
    const rejected = g.body?.draft?.grounding_state === "rejected";
    const reason = g.body?.draft?.rejection_reasons?.[0]?.code;
    record("GV2 'lifetime guarantee' → rejected", rejected && reason === "hard_blocked_claim", `reason=${reason}`);
  }

  // GV3 · superlative 'the best'
  {
    const tenant = await seedTenant(client);
    const tid = await makeTemplate(tenant, "superlative", "{{name}} is the best in Nottingham");
    const g = await generate(tenant, tid);
    const rejected = g.body?.draft?.grounding_state === "rejected";
    const reason = g.body?.draft?.rejection_reasons?.[0]?.code;
    record("GV3 'the best' → rejected", rejected && reason === "hard_blocked_claim", `reason=${reason}`);
  }

  // GV4 · explicit-reject descriptor 'premium'
  {
    const tenant = await seedTenant(client);
    const tid = await makeTemplate(tenant, "premium", "A premium staircase by {{name}}");
    const g = await generate(tenant, tid);
    const rejected = g.body?.draft?.grounding_state === "rejected";
    record("GV4 'premium' descriptor → rejected", rejected, `reason=${g.body?.draft?.rejection_reasons?.[0]?.code}`);
  }

  // GV5 · review-required 'award-winning'
  {
    const tenant = await seedTenant(client);
    const tid = await makeTemplate(tenant, "award", "{{name}} · an award-winning studio");
    const g = await generate(tenant, tid);
    const rejected = g.body?.draft?.grounding_state === "rejected";
    const reason = g.body?.draft?.rejection_reasons?.[0]?.code;
    record("GV5 'award-winning' → rejected review_required", rejected && reason === "review_required_claim", `reason=${reason}`);
  }

  // GV6 · rejection details include the offending phrase
  {
    const tenant = await seedTenant(client);
    const tid = await makeTemplate(tenant, "hashtag", "New project by {{name}} #TrustedBuilder");
    const g = await generate(tenant, tid);
    const off = g.body?.draft?.rejection_reasons?.[0]?.offending_claim;
    record("GV6 rejection carries offending_claim", typeof off === "string" && /Trusted/i.test(off), `offending=${off}`);
  }

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
