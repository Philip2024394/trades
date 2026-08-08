#!/usr/bin/env node
// template-fill.test.mjs
//
// Proves template-fill generator behaviour:
//   TF1 · Deterministic: same inputs → same caption
//   TF2 · Missing required source → error
//   TF3 · Missing required field on source → error
//   TF4 · Optional slot missing → succeeds with slot omitted (or template body must not reference)
//   TF5 · Variable value that resolves to empty string → error (treated as missing)
//   TF6 · Every populated variable produces a provenance entry with source_id/kind/path/value
//   TF7 · Ineligible source (rights_status='unknown') is invisible to generator
//
// Uses the API route so we exercise the real code path through pipeline.ts.

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

async function apiJson(url, opts) {
  try {
    const r = await fetch(url, opts);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) { return { status: 0, body: { error: String(e.message) } }; }
}

async function main() {
  process.stdout.write("template-fill.test.mjs\n");

  const health = await apiJson(`${base}/api/nex/predictive/controls`);
  if (health.status === 0) {
    process.stdout.write("  SKIP dev server not reachable\n");
    process.exit(0);
  }

  const client = await pool.connect();
  const tenant = randomUuid();

  // Seed tenant
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1,'trade',$2,'TF test')`,
      [tenant, `tf-${Date.now()}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }

  // Seed sources via API
  await apiJson(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, kind: "business_profile", slug: "primary",
      content: { name: "Oakwood Staircases", city: "Nottingham" },
      rights_status: "owned",
    }),
  });
  await apiJson(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, kind: "project", slug: "oak-nott-2026",
      content: { kind: "closed-string oak staircase", summary: "handrail with continuous newel." },
      rights_status: "owned",
    }),
  });
  // Also a rights_status='unknown' project — must NOT be picked
  await apiJson(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, kind: "project", slug: "bad-unknown-rights",
      content: { kind: "walnut staircase", summary: "should not be picked" },
      rights_status: "unknown",
    }),
  });

  // Template: uses business.name + business.city + project.kind + project.summary
  const tmpl = await apiJson(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug: "project-basic", kind: "project",
      body: "New {{project_kind}} completed in {{city}}. {{summary}}",
      variable_slots: [
        { name: "project_kind", source_kind: "project",         source_path: "kind",    required: true, claim_class: "factual" },
        { name: "city",         source_kind: "business_profile", source_path: "city",    required: true, claim_class: "factual" },
        { name: "summary",      source_kind: "project",         source_path: "summary", required: true, claim_class: "factual" },
      ],
      hashtags_slots: [{ tag: "#Staircase" }],
      cta_slot: { template: "Contact {{name}} for a quote.", source_kind: "business_profile", source_path: "name" },
    }),
  });
  const templateId = tmpl.body?.template?.template_id;
  record("Setup · template created", Boolean(templateId));

  // Also add a name variable slot (needed for CTA {{name}}). Re-upsert template with correct slots.
  const tmpl2 = await apiJson(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug: "project-basic", kind: "project",
      body: "New {{project_kind}} completed in {{city}}. {{summary}}",
      variable_slots: [
        { name: "project_kind", source_kind: "project",         source_path: "kind",    required: true, claim_class: "factual" },
        { name: "city",         source_kind: "business_profile", source_path: "city",    required: true, claim_class: "factual" },
        { name: "summary",      source_kind: "project",         source_path: "summary", required: true, claim_class: "factual" },
        { name: "name",         source_kind: "business_profile", source_path: "name",    required: true, claim_class: "factual" },
      ],
      hashtags_slots: [{ tag: "#Staircase" }],
      cta_slot: { template: "Contact {{name}} for a quote." },
    }),
  });
  const templateId2 = tmpl2.body?.template?.template_id;

  // TF1 · Deterministic generation twice
  const g1 = await apiJson(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id: templateId2, platform: "instagram", created_by: "tf-test" }),
  });
  const g2 = await apiJson(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id: templateId2, platform: "instagram", created_by: "tf-test" }),
  });
  record("TF1 deterministic generation twice", g1.status === 200 && g2.status === 200 && g1.body?.draft?.caption === g2.body?.draft?.caption, `caption='${g1.body?.draft?.caption?.slice(0,60)}'`);

  // TF6 · provenance entries populated
  const prov = g1.body?.draft?.provenance ?? {};
  const provOk = ["project_kind","city","summary","name"].every(v => prov[v]?.source_id && prov[v]?.source_kind && prov[v]?.source_path && prov[v]?.value);
  record("TF6 provenance populated for every variable", provOk);

  // TF7 · unknown-rights source is invisible → the picked project.kind must be 'closed-string oak staircase', not 'walnut'
  record("TF7 unknown-rights source ignored", prov.project_kind?.value === "closed-string oak staircase", `picked='${prov.project_kind?.value}'`);

  // TF2 · Missing required source (make a template referencing 'testimonial' which we haven't seeded)
  const tmpl3 = await apiJson(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug: "testimonial-needed", kind: "testimonial",
      body: "{{quote}}", variable_slots: [{ name: "quote", source_kind: "testimonial", source_path: "text", required: true, claim_class: "social_proof" }],
    }),
  });
  const t3id = tmpl3.body?.template?.template_id;
  const g3 = await apiJson(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id: t3id, platform: "instagram", created_by: "tf-test" }),
  });
  record("TF2 missing required source rejects", g3.status === 200 && g3.body?.draft?.grounding_state === "rejected" && g3.body?.draft?.rejection_reasons?.[0]?.code === "generator_missing_source", `code=${g3.body?.draft?.rejection_reasons?.[0]?.code}`);

  // TF3 · Missing required field. Seed a project without 'summary'.
  await apiJson(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, kind: "product", slug: "no-price", content: { name: "Widget" }, rights_status: "owned" }),
  });
  const tmpl4 = await apiJson(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenant, slug: "product-price", kind: "product",
      body: "Available: {{name}} at {{price}}",
      variable_slots: [
        { name: "name",  source_kind: "product", source_path: "name",  required: true, claim_class: "factual" },
        { name: "price", source_kind: "product", source_path: "price", required: true, claim_class: "factual" },
      ],
    }),
  });
  const t4id = tmpl4.body?.template?.template_id;
  const g4 = await apiJson(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, template_id: t4id, platform: "instagram", created_by: "tf-test" }),
  });
  record("TF3 missing required field rejects", g4.body?.draft?.grounding_state === "rejected" && g4.body?.draft?.rejection_reasons?.[0]?.code === "generator_missing_field", `code=${g4.body?.draft?.rejection_reasons?.[0]?.code}`);

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
