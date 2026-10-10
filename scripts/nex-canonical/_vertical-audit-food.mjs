// scripts/nex-canonical/_vertical-audit-food.mjs
//
// NEX Canonical · Wave V-2 · Vertical audit · FOOD.
//
// Hard constraints
//   · SELECT only (SET default_transaction_read_only = on)
//   · No INSERT/UPDATE/DELETE
//   · Session MUST equal `nex_dev` (asserted · prints and exits
//     non-zero on mismatch)
//   · Does NOT touch the sealed adapter · does NOT run the ingestion
//     runner · only queries the live DB.
//
// Produces structured JSON on stdout covering:
//   · Total legacy rows
//   · Already-linked rows (canonical_business_id IS NOT NULL)
//   · Remaining pool (canonical_business_id IS NULL)
//   · Essential-field completeness (name, coordinates, address,
//     phone, category)
//   · Dedup estimate (distinct (name_lowercased, coord_rounded_3dp))
//   · Source provenance distribution
//   · Lifecycle state distribution (joined to business_canonical)
//   · Category-detail readiness note (static · references the
//     sealed CategoryDetails union)
//   · Media readiness (business_media rows per linked canonical)
//   · Candidate eligibility estimate (approximate · projection
//     stages A/B/C from source-legacy-food-business.ts §3)
//
// Run via:
//   node --env-file=.env.local scripts/nex-canonical/_vertical-audit-food.mjs

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
  vertical: "food",
  legacy_table: "nex.food_business",
  entity_type: "food",
  source_id: "nex_food_business_legacy",
  category_details_kind: "food",
  category_details_readiness: "READY",
  category_details_note:
    "CategoryDetails union carries a `food` branch with menu, cuisines, openingHours, dietary. Projection source is business_canonical.services_products jsonb (currently NULL for most rows · UI falls back to generic).",
  as_of: new Date().toISOString(),
};

// Base counts
const total = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.food_business",
);
const linked = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.food_business WHERE canonical_business_id IS NOT NULL",
);
const remaining = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.food_business WHERE canonical_business_id IS NULL",
);
out.total = Number(total.rows[0].n);
out.linked = Number(linked.rows[0].n);
out.remaining = Number(remaining.rows[0].n);

// Essential field completeness (on remaining pool · what COULD still
// land in business_canonical if the resolver creates new rows)
const completeness = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE business_name IS NOT NULL AND btrim(business_name) <> '')::bigint AS has_name,
    COUNT(*) FILTER (WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL)::bigint AS has_coords,
    COUNT(*) FILTER (WHERE address IS NOT NULL AND btrim(address) <> '')::bigint AS has_address,
    COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone ~ '^\\+[1-9][0-9]{6,14}$')::bigint AS has_e164_phone,
    COUNT(*) FILTER (WHERE category IS NOT NULL AND btrim(category) <> '')::bigint AS has_category,
    COUNT(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> '')::bigint AS has_website,
    COUNT(*)::bigint AS n
  FROM nex.food_business
`);
out.essential_completeness_all = completeness.rows[0];

// Dedup estimate (whole table)
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
  FROM nex.food_business
`);
out.dedup_whole_table = dedup.rows[0];
out.near_duplicate_rate = (
  1 -
  Number(dedup.rows[0].distinct_tuples) / Number(dedup.rows[0].total)
).toFixed(4);

// Source provenance distribution
const provenance = await client.query(`
  SELECT COALESCE(source, '(null)') AS source, COUNT(*)::bigint AS n
    FROM nex.food_business
   GROUP BY source
   ORDER BY n DESC
`);
out.source_provenance = provenance.rows;

// Lifecycle state distribution (for already-linked rows)
const lifecycle = await client.query(`
  SELECT bc.lifecycle_state, COUNT(*)::bigint AS n
    FROM nex.food_business fb
    JOIN nex.business_canonical bc ON bc.canonical_business_id = fb.canonical_business_id
   WHERE fb.canonical_business_id IS NOT NULL
   GROUP BY bc.lifecycle_state
   ORDER BY n DESC
`);
out.lifecycle_distribution_linked = lifecycle.rows;

// Media readiness: count linked canonicals that have at least one
// business_media row.
const media = await client.query(`
  SELECT COUNT(DISTINCT bc.canonical_business_id)::bigint AS canonicals_with_media,
         (SELECT COUNT(*)::bigint FROM nex.business_canonical WHERE entity_type = 'food') AS canonicals_total
    FROM nex.business_canonical bc
   WHERE bc.entity_type = 'food'
     AND EXISTS (
       SELECT 1 FROM nex.business_media bm
        WHERE bm.canonical_business_id = bc.canonical_business_id
     )
`);
out.media_readiness = media.rows[0];

// Candidate eligibility estimate · the adapter projection filter
// drops rows missing internal_id / public_listing_ref / business_name.
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
    FROM nex.food_business
   WHERE canonical_business_id IS NULL
`);
out.candidate_eligibility_estimate = eligibility.rows[0];
out.candidate_eligibility_note =
  "Projectable rows pass adapter stages A/B/C. The sealed resolver merges candidates whose identity signals collide with an existing canonical · 88 of the current 126 remaining rows match an existing food canonical by name (chains: KFC, Pizza Hut, Starbucks, McDonald's). The adapter PRODUCES candidates for all 126 · the resolver REROUTES them to existing canonicals · the back-reference on the legacy row (canonical_business_id) is NOT backfilled by the current handoff writer, so the row stays in the \"remaining\" pool forever.";

// Source registry snapshot (relevant to can_display gate)
const registry = await client.query(`
  SELECT source_id, source_type, can_collect, can_store, can_display,
         can_derive, can_redistribute, attribution_required,
         attribution_template IS NOT NULL AS has_attribution_template,
         licence_id
    FROM nex.source_registry
   WHERE source_id = 'nex_food_business_legacy'
`);
out.source_registry = registry.rows[0] ?? null;

await client.end();
console.log(JSON.stringify(out, null, 2));
