// scripts/nex-canonical/_v1-counts.mjs
//
// Stage 1 / Task V-1 · read-only count audit against NEX_POSTGRES_URL.
// Run via: npx tsx --env-file=.env.local scripts/nex-canonical/_v1-counts.mjs
// Zero writes. Zero mutation. Fingerprint-safe (does NOT invoke the sealed
// pg-fingerprint preflight — those checks protect the ingestion runner, this
// script runs SELECTs against public introspection + public application tables
// via a plain read-only pg.Client, same pattern as the earlier schema probe
// in this session).

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL unset"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();
// Belt-and-braces: ensure session is read-only.
await client.query("SET default_transaction_read_only = on");

const out = {};

async function safeQuery(label, sql) {
  try {
    const r = await client.query(sql);
    out[label] = { ok: true, rows: r.rows };
  } catch (e) {
    out[label] = { ok: false, error: String(e.message || e).replace(/postgres[ql]*:\/\/[^@\s]+@/gi, "postgres://[redacted]@") };
  }
}

// V-1 primary: per-vertical row counts (brief's union-all exactly).
await safeQuery("vertical_counts", `
  SELECT 'food' AS vertical, COUNT(*)::bigint AS n FROM nex.food_business
  UNION ALL SELECT 'accommodation', COUNT(*)::bigint FROM nex.accommodation_business
  UNION ALL SELECT 'service',       COUNT(*)::bigint FROM nex.service_business
  UNION ALL SELECT 'mp_seller',     COUNT(*)::bigint FROM nex.mp_seller
  UNION ALL SELECT 'transport',     COUNT(*)::bigint FROM nex.transport_acquisition_record;
`);

// Canonical spine state.
await safeQuery("business_canonical_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_canonical;`);
await safeQuery("business_canonical_by_state", `
  SELECT COUNT(*)::bigint AS n, lifecycle_state
    FROM nex.business_canonical
   GROUP BY lifecycle_state
   ORDER BY lifecycle_state;
`);

// Directory surface = what would actually publish.
await safeQuery("directory_v_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_directory_v;`);

// Source registry: who can display, who can derive, who requires attribution.
await safeQuery("source_registry", `
  SELECT source_id, can_display, can_derive, attribution_required
    FROM nex.source_registry
   ORDER BY source_id;
`);

// Evidence spine.
await safeQuery("business_evidence_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_evidence;`);

// Claim table (expected absent · migration 176 unapplied).
await safeQuery("business_claim_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_claim;`);

// Lifecycle log table (expected absent · migration 168 unapplied).
await safeQuery("business_canonical_lifecycle_log_total", `
  SELECT COUNT(*)::bigint AS n FROM nex.business_canonical_lifecycle_log;
`);

// Media + fact-conflict (expected absent · 173/174 unapplied).
await safeQuery("business_media_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_media;`);
await safeQuery("business_fact_conflict_total", `SELECT COUNT(*)::bigint AS n FROM nex.business_fact_conflict;`);

// Migration status by probing presence of each applied/unapplied table/view.
await safeQuery("applied_table_probe", `
  SELECT table_name, 'table' AS kind FROM information_schema.tables
   WHERE table_schema='nex' AND table_name IN (
     'business_canonical','business_evidence','source_registry',
     'business_directory_v','business_claim',
     'business_canonical_lifecycle_log','business_media','business_fact_conflict',
     'food_business','accommodation_business','service_business','mp_seller',
     'transport_acquisition_record','food_claim_code'
   )
  UNION ALL
  SELECT table_name, 'view' AS kind FROM information_schema.views
   WHERE table_schema='nex' AND table_name LIKE 'business_%'
   ORDER BY kind, table_name;
`);

// Publishable preview: how many canonicals would actually appear in directory_v?
// (lifecycle_state must be OWNER_CLAIMED or OWNER_VERIFIED AND source gate must pass.)
await safeQuery("publishable_probe", `
  SELECT COUNT(*)::bigint AS publishable_canonicals
    FROM nex.business_canonical
   WHERE lifecycle_state IN ('OWNER_CLAIMED','OWNER_VERIFIED');
`);

// Current session identity (for the record — confirms we hit the right DB).
await safeQuery("session", `SELECT current_database() AS db, current_user AS u, version() AS v;`);

await client.end();

console.log(JSON.stringify(out, null, 2));
