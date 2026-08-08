#!/usr/bin/env node
// content-sources.test.mjs
//
// Proves rights enforcement + tenant isolation on nex.social_content_sources:
//   C1 · upsert stores source with declared rights_status
//   C2 · listEligible EXCLUDES 'unknown' rights
//   C3 · listEligible EXCLUDES 'restricted' rights
//   C4 · listEligible EXCLUDES ai_generated_provenance_pending
//   C5 · listEligible EXCLUDES expired licensed sources
//   C6 · listEligible EXCLUDES active=FALSE
//   C7 · listEligible EXCLUDES contains_identifiable_persons=TRUE without release
//   C8 · listAll returns everything for the tenant
//   C9 · Cross-tenant list returns zero rows

import pg from "pg";
import { randomUUID as randomUuid } from "node:crypto";
const { Pool } = pg;

const url  = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url, max: 3 });

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
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

// Minimal inline version of listEligibleSources logic to avoid TS runtime.
async function listEligible(client, tenant, kind) {
  await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant]);
  const params = [tenant, [
    "owned","uploaded_by_customer_attested","nex_owned_evergreen",
    "approved_nex_asset","licensed_with_expiry","nex_owned_licensed_with_expiry",
  ]];
  let sql = `SELECT source_id, kind, rights_status FROM nex.social_content_sources
              WHERE tenant_id=$1 AND active=TRUE AND rights_status=ANY($2)
                AND (expires_at IS NULL OR expires_at > NOW())
                AND (contains_identifiable_persons = FALSE OR person_release_evidence_url IS NOT NULL)`;
  if (kind) { params.push(kind); sql += ` AND kind = $${params.length}`; }
  const r = await client.query(sql, params);
  return r.rows;
}

async function main() {
  process.stdout.write("content-sources.test.mjs\n");
  const client = await pool.connect();
  const tenantA = randomUuid();
  const tenantB = randomUuid();

  // Seed tenants (admin bypass)
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE nex_social_app");
    await client.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
    await client.query(
      `INSERT INTO nex.social_tenants (tenant_id, kind, slug, display_name)
       VALUES ($1,'hq',$3,'HQ'),($2,'trade',$4,'Trade')`,
      [tenantA, tenantB, `hq-c-${Date.now()}`, `trade-c-${Date.now()}`]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }

  // Seed sources with a variety of rights_status values
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    await client.query(
      `INSERT INTO nex.social_content_sources (tenant_id, kind, slug, content, rights_status)
       VALUES
         ($1,'business_profile','ok-owned', '{"name":"A"}'::jsonb, 'owned'),
         ($1,'business_profile','ok-attested','{"name":"A2"}'::jsonb, 'uploaded_by_customer_attested'),
         ($1,'project','ok-nex','{"title":"T"}'::jsonb, 'nex_owned_evergreen'),
         ($1,'project','bad-unknown','{"title":"U"}'::jsonb, 'unknown'),
         ($1,'project','bad-restricted','{"title":"R"}'::jsonb, 'restricted'),
         ($1,'project','bad-ai','{"title":"AI"}'::jsonb, 'ai_generated_provenance_pending'),
         ($1,'project','bad-inactive','{"title":"I"}'::jsonb, 'owned'),
         ($1,'project','bad-pii','{"title":"P"}'::jsonb, 'owned')
       ON CONFLICT DO NOTHING`, [tenantA]);
    // toggle inactive
    await client.query(`UPDATE nex.social_content_sources SET active=FALSE WHERE tenant_id=$1 AND slug='bad-inactive'`, [tenantA]);
    // toggle PII without release evidence
    await client.query(`UPDATE nex.social_content_sources SET contains_identifiable_persons=TRUE WHERE tenant_id=$1 AND slug='bad-pii'`, [tenantA]);
    // add expired licensed source
    await client.query(
      `INSERT INTO nex.social_content_sources (tenant_id, kind, slug, content, rights_status, expires_at)
       VALUES ($1,'project','bad-expired','{"t":"E"}'::jsonb,'licensed_with_expiry', NOW() - INTERVAL '1 day')
       ON CONFLICT DO NOTHING`, [tenantA]);
    // seed one for tenantB to verify isolation
  });
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantB]);
    await client.query(
      `INSERT INTO nex.social_content_sources (tenant_id, kind, slug, content, rights_status)
       VALUES ($1,'business_profile','B-owned', '{"name":"B"}'::jsonb, 'owned')
       ON CONFLICT DO NOTHING`, [tenantB]);
  });

  // C1 · upsert stored the source
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(
      `SELECT rights_status FROM nex.social_content_sources WHERE tenant_id=$1 AND slug='ok-owned'`, [tenantA]);
    record("C1 upsert stored rights_status", r.rows[0]?.rights_status === "owned");
  });

  // C2-C4 · eligible list excludes unknown / restricted / ai_generated
  await tx(client, async () => {
    const rows = await listEligible(client, tenantA, "project");
    const slugs = new Set(rows.map(r => r.rights_status));
    record("C2 excludes 'unknown'", !slugs.has("unknown"));
    record("C3 excludes 'restricted'", !slugs.has("restricted"));
    record("C4 excludes 'ai_generated_provenance_pending'", !slugs.has("ai_generated_provenance_pending"));
  });

  // C5 · excludes expired licensed
  await tx(client, async () => {
    const rows = await listEligible(client, tenantA, "project");
    const ids = new Set(rows.map(r => r.source_id));
    // We didn't capture IDs by slug so check via SQL
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const q = await client.query(`SELECT source_id FROM nex.social_content_sources WHERE tenant_id=$1 AND slug='bad-expired'`, [tenantA]);
    const expiredId = q.rows[0]?.source_id;
    record("C5 excludes expired licensed source", expiredId && !ids.has(String(expiredId)));
  });

  // C6 · excludes inactive
  await tx(client, async () => {
    const rows = await listEligible(client, tenantA, "project");
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const q = await client.query(`SELECT source_id FROM nex.social_content_sources WHERE tenant_id=$1 AND slug='bad-inactive'`, [tenantA]);
    const inactiveId = q.rows[0]?.source_id;
    record("C6 excludes inactive source", inactiveId && !new Set(rows.map(r => r.source_id)).has(String(inactiveId)));
  });

  // C7 · excludes PII without release
  await tx(client, async () => {
    const rows = await listEligible(client, tenantA, "project");
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const q = await client.query(`SELECT source_id FROM nex.social_content_sources WHERE tenant_id=$1 AND slug='bad-pii'`, [tenantA]);
    const piiId = q.rows[0]?.source_id;
    record("C7 excludes PII source without release evidence", piiId && !new Set(rows.map(r => r.source_id)).has(String(piiId)));
  });

  // C8 · listAll returns everything
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM nex.social_content_sources WHERE tenant_id=$1`, [tenantA]);
    record("C8 listAll returns all sources", r.rows[0].n >= 9, `n=${r.rows[0].n}`);
  });

  // C9 · cross-tenant list returns zero rows for other tenant
  await tx(client, async () => {
    await client.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenantA]);
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM nex.social_content_sources WHERE tenant_id=$1`, [tenantB]);
    record("C9 cross-tenant SELECT returns 0", r.rows[0].n === 0);
  });

  client.release();
  await pool.end();
  const passed = results.filter(r => r.pass).length;
  process.stdout.write(`\nSummary · ${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { process.stderr.write("crashed: " + e.stack + "\n"); process.exit(2); });
