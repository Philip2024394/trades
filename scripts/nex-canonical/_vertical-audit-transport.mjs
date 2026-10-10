// scripts/nex-canonical/_vertical-audit-transport.mjs
//
// NEX Canonical · Wave V-2 · Vertical audit · TRANSPORT.
// Read-only · nex_dev. nex.transport_acquisition_record has:
//   · provider_id (uuid PK), provider_kind (enum), business_name,
//     contact_person_name (PII · never promoted to name_canonical),
//     canonical_phone_e164, website, home_jurisdiction, city,
//     province, discovery_stage.
//   · NO canonical_business_id column (migration 169 skipped this
//     table · the 107 rows are a special-case acquisition pipeline).

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) {
  console.error("NEX_POSTGRES_URL unset");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET default_transaction_read_only = on");

const idRes = await client.query(
  "SELECT current_database() AS db, current_user AS u",
);
if (idRes.rows[0].db !== "nex_dev") {
  console.error(
    JSON.stringify({
      error: "wrong_database",
      expected: "nex_dev",
      actual: idRes.rows[0].db,
    }),
  );
  await client.end();
  process.exit(3);
}

const out = {
  vertical: "transport",
  legacy_table: "nex.transport_acquisition_record",
  entity_type: "transport_operator / transport_driver",
  source_id: "nex_transport_acquisition_legacy",
  category_details_kind: "transport",
  category_details_readiness: "PARTIAL",
  category_details_note:
    "CategoryDetails union carries a `transport` branch (serviceTypes, coverage, priceMethod). provider_kind would map to serviceTypes (fleet_operator, logistics_operator, courier_operator, etc.). Projection source: business_canonical.services_products jsonb · empty at ingest · generic fallback until owner-claim fills.",
  as_of: new Date().toISOString(),
};

// Note: this table lacks a canonical_business_id column · migration
// 169 did not extend it (reviewer should see this in the audit).
out.has_canonical_fk_column = false;
out.linked = "N/A · no FK column on this legacy table";
out.linked_note =
  "nex.transport_acquisition_record was NOT extended with canonical_business_id in migration 169 (only food, accommodation, service, mp_seller were). Linkage between a transport legacy row and its business_canonical row is not persisted. The adapter still produces candidates; the resolver still writes canonical rows; but the back-reference cannot be set until a new migration adds the column (or an alternate join table is introduced).";

const total = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.transport_acquisition_record",
);
out.total = Number(total.rows[0].n);

// Provider kind distribution (drives routing to entity_type).
const providerKinds = await client.query(`
  SELECT provider_kind, COUNT(*)::bigint AS n
    FROM nex.transport_acquisition_record
   GROUP BY provider_kind
   ORDER BY n DESC
`);
out.provider_kind_distribution = providerKinds.rows;

const completeness = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE business_name IS NOT NULL AND btrim(business_name) <> '')::bigint AS has_business_name,
    COUNT(*) FILTER (WHERE contact_person_name IS NOT NULL AND btrim(contact_person_name) <> '')::bigint AS has_contact_person_name_pii,
    COUNT(*) FILTER (WHERE canonical_phone_e164 IS NOT NULL AND canonical_phone_e164 ~ '^\\+[1-9][0-9]{6,14}$')::bigint AS has_e164_phone,
    COUNT(*) FILTER (WHERE home_jurisdiction IS NOT NULL AND btrim(home_jurisdiction) <> '')::bigint AS has_jurisdiction,
    COUNT(*) FILTER (WHERE city IS NOT NULL AND btrim(city) <> '')::bigint AS has_city,
    COUNT(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> '')::bigint AS has_website,
    COUNT(*)::bigint AS n
  FROM nex.transport_acquisition_record
`);
out.essential_completeness_all = completeness.rows[0];

// Dedup estimate · (name, phone).
const dedup = await client.query(`
  SELECT
    COUNT(DISTINCT (
      lower(btrim(coalesce(business_name, ''))) ||
      '|' ||
      coalesce(canonical_phone_e164, '')
    ))::bigint AS distinct_tuples,
    COUNT(*)::bigint AS total
  FROM nex.transport_acquisition_record
`);
out.dedup_whole_table = dedup.rows[0];
out.near_duplicate_rate = (
  1 -
  Number(dedup.rows[0].distinct_tuples) / Number(dedup.rows[0].total)
).toFixed(4);

// Media readiness · canonicals in transport_operator or
// transport_driver.
const media = await client.query(`
  SELECT COUNT(DISTINCT bc.canonical_business_id)::bigint AS canonicals_with_media,
         (SELECT COUNT(*)::bigint FROM nex.business_canonical WHERE entity_type IN ('transport_operator','transport_driver')) AS canonicals_total
    FROM nex.business_canonical bc
   WHERE bc.entity_type IN ('transport_operator','transport_driver')
     AND EXISTS (
       SELECT 1 FROM nex.business_media bm
        WHERE bm.canonical_business_id = bc.canonical_business_id
     )
`);
out.media_readiness = media.rows[0];

// Candidate eligibility · adapter rejects:
//   · provider_id or provider_kind null
//   · provider_kind quarantined ('unknown')
//   · business_name blank (PII guard · contact_person_name does NOT
//     substitute)
const eligibility = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE
      provider_id IS NOT NULL
      AND provider_kind IS NOT NULL
      AND provider_kind IN (
        'individual_driver','driver_operator',
        'fleet_operator','transport_business',
        'courier_operator','logistics_operator'
      )
      AND business_name IS NOT NULL
      AND btrim(business_name) <> ''
    )::bigint AS projectable_business_name,
    COUNT(*) FILTER (WHERE
      provider_kind = 'unknown'
    )::bigint AS quarantined_unknown,
    COUNT(*) FILTER (WHERE
      business_name IS NULL OR btrim(business_name) = ''
    )::bigint AS dropped_no_business_name_pii_guard,
    COUNT(*)::bigint AS total
    FROM nex.transport_acquisition_record
`);
out.candidate_eligibility_estimate = eligibility.rows[0];
out.candidate_eligibility_note =
  "Projectable rows survive the adapter's quarantine + PII guard. The adapter DROPS contact_person_name-only rows (migration 091 PII boundary); those rows cannot ingest as a business until a business_name is on file. transport_acquisition_record is small (107 rows) and acquired directly by NEX · no third-party attribution owed · but per-row consent audit is required for display.";

const lifecycle = await client.query(`
  SELECT bc.lifecycle_state, COUNT(*)::bigint AS n
    FROM nex.business_canonical bc
   WHERE bc.entity_type IN ('transport_operator','transport_driver')
   GROUP BY bc.lifecycle_state
   ORDER BY n DESC
`);
out.lifecycle_distribution_canonicals_transport = lifecycle.rows;

const registry = await client.query(`
  SELECT source_id, source_type, can_collect, can_store, can_display,
         can_derive, can_redistribute, attribution_required,
         attribution_template IS NOT NULL AS has_attribution_template,
         licence_id
    FROM nex.source_registry
   WHERE source_id = 'nex_transport_acquisition_legacy'
`);
out.source_registry = registry.rows[0] ?? null;

await client.end();
console.log(JSON.stringify(out, null, 2));
