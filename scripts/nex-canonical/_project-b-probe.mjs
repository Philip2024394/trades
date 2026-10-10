// scripts/nex-canonical/_project-b-probe.mjs
// Read-only probe against the Supabase Project B pooler (NEX_POSTGRES_URL in
// .env.harvest.local). Scoped exactly to the three questions:
//   (a) which DB does the walker target
//   (b) does business_canonical exist in Project B
//   (c) harvest substrate counts (what are walkers actually writing)
//
// Zero writes. SET default_transaction_read_only = on.

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL unset"); process.exit(1); }

const useSSL = /supabase\.(co|com)/i.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
await client.query("SET default_transaction_read_only = on");

const out = {};
async function q(label, sql) {
  try { out[label] = { ok: true, rows: (await client.query(sql)).rows }; }
  catch (e) { out[label] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
}

// Session identity · confirms I hit Project B, not nex_dev.
await q("session", `SELECT current_database() AS db, current_user AS u, version() AS v;`);

// Does the sealed canonical spine exist here?
await q("spine_tables_present", `
  SELECT table_name
    FROM information_schema.tables
   WHERE table_schema='nex'
     AND table_name IN (
       'business_canonical','business_evidence','source_registry',
       'business_media','business_fact_conflict','business_claim',
       'business_canonical_lifecycle_log','business_directory_v',
       'harvest_business_candidate','harvest_job','walk_audit',
       'food_business','accommodation_business','service_business',
       'mp_seller','transport_acquisition_record'
     )
   ORDER BY table_name;
`);

// If spine exists, count it (otherwise rows will error — safeQuery handles).
await q("business_canonical_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_canonical;`);
await q("business_canonical_by_state", `SELECT COUNT(*)::bigint AS n, lifecycle_state FROM nex.business_canonical GROUP BY lifecycle_state ORDER BY lifecycle_state;`);
await q("business_directory_v_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_directory_v;`);
await q("business_evidence_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_evidence;`);
await q("business_media_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_media;`);

// Harvest substrate · what walkers are actually writing.
await q("harvest_candidate_total", `SELECT COUNT(*)::bigint AS n FROM nex.harvest_business_candidate;`);
await q("harvest_job_counts", `
  SELECT status, COUNT(*)::bigint AS n FROM nex.harvest_job GROUP BY status ORDER BY status;
`);
await q("walk_audit_total", `SELECT COUNT(*)::bigint AS n FROM nex.walk_audit;`);
await q("walk_audit_recent_outcomes", `
  SELECT outcome, COUNT(*)::bigint AS n
    FROM nex.walk_audit
   WHERE at > now() - interval '7 days'
   GROUP BY outcome
   ORDER BY n DESC;
`);

// Vertical row counts in Project B (do walkers ingest into them here too?).
await q("vertical_counts_project_b", `
  SELECT 'food' AS vertical, COUNT(*)::bigint AS n FROM nex.food_business
  UNION ALL SELECT 'accommodation', COUNT(*)::bigint FROM nex.accommodation_business
  UNION ALL SELECT 'service',       COUNT(*)::bigint FROM nex.service_business
  UNION ALL SELECT 'mp_seller',     COUNT(*)::bigint FROM nex.mp_seller
  UNION ALL SELECT 'transport',     COUNT(*)::bigint FROM nex.transport_acquisition_record;
`);

// Last activity signal: when did the harvest substrate last write?
await q("harvest_last_activity", `
  SELECT MAX(created_at) AS last_candidate_at FROM nex.harvest_business_candidate;
`);
await q("walk_last_audit", `
  SELECT MAX(at) AS last_walk_at FROM nex.walk_audit;
`);

await client.end();
console.log(JSON.stringify(out, null, 2));
