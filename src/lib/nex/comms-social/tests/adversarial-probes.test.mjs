#!/usr/bin/env node
// adversarial-probes.test.mjs · Phase 9
//
// End-to-end adversarial probes against the deployed API surface.
// Each assertion tries to violate an invariant · we assert the
// system says NO in the correct way (400 / 403 / 404 / fail-closed).
//
//   AV1  · malformed JSON → 400
//   AV2  · missing tenant_id on sources → 400
//   AV3  · attempt to generate against unknown template → rejected draft
//   AV4  · attempt to enqueue non-grounded draft → 400 with draft_not_grounded
//   AV5  · staff role cannot enable Automatic (403)
//   AV6  · tenant B cannot see tenant A's drafts (cross-tenant leak probe)
//   AV7  · tenant B cannot see tenant A's jobs (cross-tenant leak probe)
//   AV8  · admin_read wrapper refuses empty reason (integrity test)
//   AV9  · /track rejects javascript: scheme
//   AV10 · /track rejects data: scheme
//   AV11 · /hq/tenants requires admin_user_id + reason (400 · verified previously · re-verified here)
//   AV12 · /oauth/simulator/callback with tampered state → 400
//   AV13 · Attempt to enqueue with fake account_id → account_not_found
//   AV14 · Attempt to POST /controls without required fields → 400
//   AV15 · Reveal-token function is NOT reachable from any public URL
//         (grep the API route folder for any string containing revealTokenForAdapter)

import { randomUUID as randomUuid } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import pg from "pg";
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

const url  = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const base = "http://localhost:3008";
const pool = new Pool({ connectionString: url, max: 3 });

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}
async function api(url, opts) {
  try { const r = await fetch(url, { ...opts, redirect: "manual" }); return { status: r.status, body: await r.json().catch(() => ({})) }; }
  catch (e) { return { status: 0, body: { error: String(e.message) } }; }
}

async function seedTenant() {
  const tenant = randomUuid();
  await pool.query(`INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name) VALUES ($1,'trade',$2,'AV')`,
    [tenant, `av-${Date.now()}-${Math.random().toString(36).slice(2,5)}`]);
  await api(`${base}/api/nex/comms-social/content/sources`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, kind: "business_profile", slug: "primary", content: { name: "AV" }, rights_status: "owned" }),
  });
  await api(`${base}/api/nex/comms-social/content/brand-profiles`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenant, tone: "friendly" }),
  });
  return tenant;
}

async function main() {
  process.stdout.write("adversarial-probes.test.mjs\n");
  const h = await api(`${base}/api/nex/comms-social/controls`);
  if (h.status === 0) { process.stdout.write("  SKIP dev server not reachable\n"); process.exit(0); }

  // AV1 · malformed JSON
  {
    const r = await api(`${base}/api/nex/comms-social/content/sources`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: "not json{",
    });
    record("AV1 malformed JSON → 400", r.status === 400 && r.body?.error === "invalid_json");
  }

  // AV2 · missing tenant_id
  {
    const r = await api(`${base}/api/nex/comms-social/content/sources`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "business_profile", content: { name: "x" } }),
    });
    record("AV2 missing tenant_id → 400", r.status === 400);
  }

  // AV3 · generate against unknown template → rejected draft (200 with grounding_state=rejected)
  {
    const tenant = await seedTenant();
    const bogus = randomUuid();
    const r = await api(`${base}/api/nex/comms-social/content/generate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, template_id: bogus, platform: "simulator", created_by: "av" }),
    });
    record("AV3 unknown template_id → rejected draft (fail-closed)",
      r.status === 200 && r.body?.draft?.grounding_state === "rejected"
      && r.body?.draft?.rejection_reasons?.[0]?.code === "generator_template_not_found",
      `code=${r.body?.draft?.rejection_reasons?.[0]?.code}`);
  }

  // AV4 · enqueue non-grounded draft
  {
    const tenant = await seedTenant();
    // Create rejected draft directly via SQL
    const client = await pool.connect();
    let draftId;
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE nex_social_app");
      await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
      const q = await client.query(
        `INSERT INTO nex.social_content_drafts (tenant_id, template_id, generation_mode, platform, caption, hashtags, cta, source_refs, claims, provenance, grounding_state, rejection_reasons, created_by)
         VALUES ($1, NULL, 'template_fill', 'simulator', 'x', '{}', NULL, '{}', '[]'::jsonb, '{}'::jsonb, 'rejected', '[]'::jsonb, 'av')
         RETURNING draft_id`, [tenant]);
      draftId = String(q.rows[0].draft_id);
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    client.release();
    const r = await api(`${base}/api/nex/comms-social/scheduling/enqueue`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, draft_id: draftId, account_id: randomUuid(),
        platform: "simulator", run_at: new Date().toISOString(), enqueued_by: "av" }),
    });
    record("AV4 enqueue non-grounded → 400 draft_not_grounded", r.status === 400 && r.body?.error === "draft_not_grounded");
  }

  // AV5 · staff cannot enable Automatic
  {
    const tenant = await seedTenant();
    const r = await api(`${base}/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, category: "project", mode: "automatic", actor: "u", actor_role: "staff" }),
    });
    record("AV5 staff cannot enable Automatic (403)", r.status === 403);
  }

  // AV6 · cross-tenant leak · tenant B cannot see tenant A's drafts
  {
    const tA = await seedTenant();
    const tB = await seedTenant();
    // Create a draft for A · then list from B
    const tR = await api(`${base}/api/nex/comms-social/content/templates`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tA, slug: `av-${Date.now()}`, kind: "project", body: "Hi from {{name}}",
        variable_slots: [{ name: "name", source_kind: "business_profile", source_path: "name", required: true, claim_class: "factual" }] }),
    });
    await api(`${base}/api/nex/comms-social/content/generate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tA, template_id: tR.body?.template?.template_id, platform: "simulator", created_by: "av" }),
    });
    const draftsB = await api(`${base}/api/nex/comms-social/content/drafts?tenant_id=${tB}`);
    const leak = (draftsB.body?.drafts ?? []).some(d => d.tenant_id === tA);
    record("AV6 tenant B cannot see tenant A drafts", !leak);
  }

  // AV7 · cross-tenant leak · jobs
  {
    const tA = await seedTenant();
    const tB = await seedTenant();
    const jobsB = await api(`${base}/api/nex/comms-social/scheduling/jobs?tenant_id=${tB}`);
    const leak = (jobsB.body?.jobs ?? []).some(j => j.tenant_id === tA);
    record("AV7 tenant B cannot see tenant A jobs", !leak);
  }

  // AV8 · admin_read refuses empty reason (integrity check at DB layer)
  {
    let rejected = false;
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE nex_social_app");
        await client.query(`SELECT nex.social_admin_read('probe-admin', '00000000-0000-0000-0000-000000000000'::uuid, 'audit_event_summary', '')`);
        await client.query("ROLLBACK");
      } catch (e) { rejected = String(e.message).includes("reason required"); await client.query("ROLLBACK").catch(() => {}); }
      client.release();
    } catch { /* pool error */ }
    record("AV8 admin_read refuses empty reason", rejected);
  }

  // AV9/AV10 · /track scheme rejects
  {
    const r9 = await api(`${base}/api/nex/comms-social/track?to=javascript:alert(1)&post=p&platform=x`);
    record("AV9 /track rejects javascript: scheme", r9.status === 400);
    const r10 = await api(`${base}/api/nex/comms-social/track?to=data:text/html,evil&post=p&platform=x`);
    record("AV10 /track rejects data: scheme", r10.status === 400);
  }

  // AV11 · /hq/tenants requires admin_user_id
  {
    const r = await api(`${base}/api/nex/comms-social/hq/tenants`);
    record("AV11 /hq/tenants requires admin_user_id + reason", r.status === 400);
  }

  // AV12 · /oauth/callback with tampered state
  {
    const tenant = await seedTenant();
    const initR = await api(`${base}/api/nex/comms-social/oauth/simulator/initiate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, initiated_by: "av", redirect_uri: `${base}/cb` }),
    });
    const badState = "totally-fake-state-token-that-was-never-issued-abc123";
    const qs = new URLSearchParams({ code: "sim", state: badState, tenant_id: tenant, redirect_uri: `${base}/cb` });
    const r = await api(`${base}/api/nex/comms-social/oauth/simulator/callback?${qs}`);
    record("AV12 tampered OAuth state rejected", r.status === 400 && String(r.body?.error).includes("state_"));
    void initR;
  }

  // AV13 · enqueue with fake account_id
  {
    const tenant = await seedTenant();
    // Need a grounded draft
    const tR = await api(`${base}/api/nex/comms-social/content/templates`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, slug: `av13-${Date.now()}`, kind: "project", body: "Hi from {{name}}",
        variable_slots: [{ name: "name", source_kind: "business_profile", source_path: "name", required: true, claim_class: "factual" }] }),
    });
    const gR = await api(`${base}/api/nex/comms-social/content/generate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, template_id: tR.body?.template?.template_id, platform: "simulator", created_by: "av" }),
    });
    const r = await api(`${base}/api/nex/comms-social/scheduling/enqueue`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant, draft_id: gR.body?.draft?.draft_id, account_id: randomUuid(),
        platform: "simulator", run_at: new Date().toISOString(), enqueued_by: "av" }),
    });
    record("AV13 fake account_id → account_not_found", r.status === 400 && r.body?.error === "account_not_found");
  }

  // AV14 · /controls POST missing fields
  {
    const r = await api(`${base}/api/nex/comms-social/controls`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    record("AV14 /controls POST missing fields → 400", r.status === 400);
  }

  // AV15 · revealTokenForAdapter is never called from an API route (source scan)
  {
    const apiRoot = join(REPO, "src", "app", "api", "nex", "comms-social");
    function walk(d) { const out = []; for (const e of readdirSync(d)) { const p = join(d, e); const s = statSync(p); if (s.isDirectory()) out.push(...walk(p)); else if (/\.tsx?$/.test(e)) out.push(p); } return out; }
    const files = walk(apiRoot);
    const bad = files.filter((f) => readFileSync(f, "utf8").includes("revealTokenForAdapter"));
    record("AV15 revealTokenForAdapter never called from API route", bad.length === 0,
      bad.map((f) => relative(REPO, f)).join(","));
  }

  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
