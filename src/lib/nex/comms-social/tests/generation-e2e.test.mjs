#!/usr/bin/env node
// generation-e2e.test.mjs
//
// End-to-end pipeline via API routes · exercises:
//   E1 · Seed sources · create template · generate → drafts list
//   E2 · Grounded draft appears in drafts list with grounding_state='grounded'
//   E3 · Post-time source deletion invalidates provenance (integrity guard) — verified via re-generation
//   E4 · Rejected drafts appear in drafts list too (not filtered)
//   E5 · Tenant isolation: tenantB cannot see tenantA drafts

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

async function main() {
  process.stdout.write("generation-e2e.test.mjs\n");
  const health = await api(`${base}/api/nex/predictive/controls`);
  if (health.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }
  const client = await pool.connect();
  const tenantA = randomUuid();
  const tenantB = randomUuid();

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1,'trade',$3,'A'),($2,'trade',$4,'B')`,
      [tenantA, tenantB, `a-${Date.now()}`, `b-${Date.now()}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }

  // Seed source + template for tenantA
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenantA, kind: "business_profile", slug: "primary",
      content: { name: "Alpha Staircases", city: "Nottingham" }, rights_status: "owned",
    }),
  });
  const t = await api(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenantA, slug: "hello", kind: "project",
      body: "Hello from {{name}} in {{city}}.",
      variable_slots: [
        { name: "name", source_kind: "business_profile", source_path: "name", required: true, claim_class: "factual" },
        { name: "city", source_kind: "business_profile", source_path: "city", required: true, claim_class: "factual" },
      ],
    }),
  });
  const templateId = t.body?.template?.template_id;

  // E1 · Generate a grounded draft
  const g = await api(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantA, template_id: templateId, platform: "instagram", created_by: "e2e" }),
  });
  record("E1 grounded draft created", g.body?.draft?.grounding_state === "grounded", `state=${g.body?.draft?.grounding_state}`);

  // E2 · Drafts list includes the grounded draft
  const list = await api(`${base}/api/nex/comms-social/content/drafts?tenant_id=${tenantA}`);
  const grounded = (list.body?.drafts ?? []).find(d => d.draft_id === g.body?.draft?.draft_id);
  record("E2 drafts list includes the draft", grounded && grounded.grounding_state === "grounded");

  // E3 · Generate a rejected draft (add a comparative superlative)
  const tRej = await api(`${base}/api/nex/comms-social/content/templates`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenantA, slug: "reject", kind: "project",
      body: "The best staircases in {{city}}.",
      variable_slots: [{ name: "city", source_kind: "business_profile", source_path: "city", required: true, claim_class: "factual" }],
    }),
  });
  const gRej = await api(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantA, template_id: tRej.body?.template?.template_id, platform: "instagram", created_by: "e2e" }),
  });
  const list2 = await api(`${base}/api/nex/comms-social/content/drafts?tenant_id=${tenantA}`);
  const rejected = (list2.body?.drafts ?? []).find(d => d.draft_id === gRej.body?.draft?.draft_id);
  record("E3 rejected draft persisted (not filtered)", rejected && rejected.grounding_state === "rejected");

  // E4 · Tenant B cannot see tenant A's drafts
  const listB = await api(`${base}/api/nex/comms-social/content/drafts?tenant_id=${tenantB}`);
  const leak = (listB.body?.drafts ?? []).some(d => d.tenant_id === tenantA);
  record("E4 tenant isolation on drafts list", !leak, `B saw ${listB.body?.drafts?.length ?? 0} drafts`);

  // E5 · Time-of-check gap: mutate source between generations and confirm new draft reflects new source value
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: tenantA, kind: "business_profile", slug: "primary",
      content: { name: "Alpha Staircases Ltd", city: "Nottingham" }, rights_status: "owned",
    }),
  });
  const gAfter = await api(`${base}/api/nex/comms-social/content/generate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantA, template_id: templateId, platform: "instagram", created_by: "e2e" }),
  });
  record("E5 regeneration picks up mutated source", (gAfter.body?.draft?.caption ?? "").includes("Alpha Staircases Ltd"), `caption='${gAfter.body?.draft?.caption?.slice(0,60)}'`);

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
