// scripts/nex-canonical/_vertical-audit-accommodation.mjs
//
// NEX Canonical · Wave V-2 · Vertical audit · ACCOMMODATION.
// Read-only · nex_dev · same shape as _vertical-audit-food.mjs.

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
  vertical: "accommodation",
  legacy_table: "nex.accommodation_business",
  entity_type: "accommodation",
  source_id: "nex_accommodation_business_legacy",
  category_details_kind: "accommodation",
  category_details_readiness: "READY",
  category_details_note:
    "CategoryDetails union carries an `accommodation` branch with roomTypes and facilities. Facility vocabulary is sealed (16 values). Projection source is business_canonical.services_products jsonb (currently empty for all rows · UI falls back to generic).",
  as_of: new Date().toISOString(),
};

const total = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.accommodation_business",
);
const linked = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.accommodation_business WHERE canonical_business_id IS NOT NULL",
);
const remaining = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.accommodation_business WHERE canonical_business_id IS NULL",
);
out.total = Number(total.rows[0].n);
out.linked = Number(linked.rows[0].n);
out.remaining = Number(remaining.rows[0].n);

const completeness = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE business_name IS NOT NULL AND btrim(business_name) <> '')::bigint AS has_name,
    COUNT(*) FILTER (WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL)::bigint AS has_coords,
    COUNT(*) FILTER (WHERE address IS NOT NULL AND btrim(address) <> '')::bigint AS has_address,
    COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone ~ '^\\+[1-9][0-9]{6,14}$')::bigint AS has_e164_phone,
    COUNT(*) FILTER (WHERE category IS NOT NULL AND btrim(category) <> '')::bigint AS has_category,
    COUNT(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> '')::bigint AS has_website,
    COUNT(*)::bigint AS n
  FROM nex.accommodation_business
`);
out.essential_completeness_all = completeness.rows[0];

const dedup = await client.query(`
  SELECT
    COUNT(DISTINCT (
      lower(btrim(business_name)) ||
      '|' ||
      coalesce(round(coordinates_lat::numeric, 3)::text, '') ||
      '|' ||
      coalesce(round(coordinates_lng::numeric, 3)::text, '')
    ))::bigint AS distinct_tuples,
    COUNT(*)::bigint AS total
  FROM nex.accommodation_business
`);
out.dedup_whole_table = dedup.rows[0];
out.near_duplicate_rate = (
  1 -
  Number(dedup.rows[0].distinct_tuples) / Number(dedup.rows[0].total)
).toFixed(4);

const provenance = await client.query(`
  SELECT COALESCE(source, '(null)') AS source, COUNT(*)::bigint AS n
    FROM nex.accommodation_business
   GROUP BY source
   ORDER BY n DESC
`);
out.source_provenance = provenance.rows;

const lifecycle = await client.query(`
  SELECT bc.lifecycle_state, COUNT(*)::bigint AS n
    FROM nex.accommodation_business ab
    JOIN nex.business_canonical bc ON bc.canonical_business_id = ab.canonical_business_id
   WHERE ab.canonical_business_id IS NOT NULL
   GROUP BY bc.lifecycle_state
   ORDER BY n DESC
`);
out.lifecycle_distribution_linked = lifecycle.rows;

const media = await client.query(`
  SELECT COUNT(DISTINCT bc.canonical_business_id)::bigint AS canonicals_with_media,
         (SELECT COUNT(*)::bigint FROM nex.business_canonical WHERE entity_type = 'accommodation') AS canonicals_total
    FROM nex.business_canonical bc
   WHERE bc.entity_type = 'accommodation'
     AND EXISTS (
       SELECT 1 FROM nex.business_media bm
        WHERE bm.canonical_business_id = bc.canonical_business_id
     )
`);
out.media_readiness = media.rows[0];

const eligibility = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE
      internal_id IS NOT NULL
      AND public_listing_ref IS NOT NULL
      AND btrim(public_listing_ref) <> ''
      AND business_name IS NOT NULL
      AND btrim(business_name) <> ''
    )::bigint AS projectable,
    COUNT(*)::bigint AS remaining
    FROM nex.accommodation_business
   WHERE canonical_business_id IS NULL
`);
out.candidate_eligibility_estimate = eligibility.rows[0];
out.candidate_eligibility_note =
  "Projectable rows pass adapter stages A/B/C (same filter shape as food). The sealed resolver may merge against existing canonicals; without a prior ingestion wave for accommodation most rows are expected to resolve to NEW canonicals.";

const registry = await client.query(`
  SELECT source_id, source_type, can_collect, can_store, can_display,
         can_derive, can_redistribute, attribution_required,
         attribution_template IS NOT NULL AS has_attribution_template,
         licence_id
    FROM nex.source_registry
   WHERE source_id = 'nex_accommodation_business_legacy'
`);
out.source_registry = registry.rows[0] ?? null;

await client.end();
console.log(JSON.stringify(out, null, 2));
