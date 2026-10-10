// scripts/nex-canonical/_vertical-audit-mp-seller.mjs
//
// NEX Canonical · Wave V-2 · Vertical audit · MARKETPLACE SELLER.
// Read-only · nex_dev. nex.mp_seller has no coordinates, no phone, no
// address · identity is seller_id/slug/display_name/jurisdiction/bio.

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
  vertical: "mp_seller",
  legacy_table: "nex.mp_seller",
  entity_type: "marketplace_seller",
  source_id: "nex_mp_seller_legacy",
  category_details_kind: "marketplace_seller",
  category_details_readiness: "PARTIAL",
  category_details_note:
    "CategoryDetails union carries a `marketplace_seller` branch (productCategories, shippingScope). The legacy table has no explicit productCategories column · they would need to be sourced from business_canonical.services_products jsonb which is empty at ingestion time. UI will fall back to generic card until owner-claim populates services_products.",
  as_of: new Date().toISOString(),
};

const total = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.mp_seller",
);
const linked = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.mp_seller WHERE canonical_business_id IS NOT NULL",
);
const remaining = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.mp_seller WHERE canonical_business_id IS NULL",
);
out.total = Number(total.rows[0].n);
out.linked = Number(linked.rows[0].n);
out.remaining = Number(remaining.rows[0].n);

// mp_seller has NO coordinates, NO phone, NO address, NO website -
// identity is name + jurisdiction + optional contact_ref.
const completeness = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE display_name IS NOT NULL AND btrim(display_name) <> '')::bigint AS has_name,
    COUNT(*) FILTER (WHERE slug IS NOT NULL AND btrim(slug) <> '')::bigint AS has_slug,
    COUNT(*) FILTER (WHERE city IS NOT NULL AND btrim(city) <> '')::bigint AS has_city,
    COUNT(*) FILTER (WHERE jurisdiction IS NOT NULL AND btrim(jurisdiction) <> '')::bigint AS has_jurisdiction,
    COUNT(*) FILTER (WHERE bio IS NOT NULL AND btrim(bio) <> '')::bigint AS has_bio,
    COUNT(*) FILTER (WHERE contact_ref IS NOT NULL AND btrim(contact_ref) <> '')::bigint AS has_contact_ref,
    COUNT(*)::bigint AS n
  FROM nex.mp_seller
`);
out.essential_completeness_all = completeness.rows[0];

// Dedup estimate · no coordinates · use (name, jurisdiction).
const dedup = await client.query(`
  SELECT
    COUNT(DISTINCT (
      lower(btrim(display_name)) ||
      '|' ||
      coalesce(btrim(jurisdiction), '')
    ))::bigint AS distinct_tuples,
    COUNT(*)::bigint AS total
  FROM nex.mp_seller
`);
out.dedup_whole_table = dedup.rows[0];
out.near_duplicate_rate = (
  1 -
  Number(dedup.rows[0].distinct_tuples) / Number(dedup.rows[0].total)
).toFixed(4);

const provenance = await client.query(`
  SELECT COALESCE(source, '(null)') AS source, COUNT(*)::bigint AS n
    FROM nex.mp_seller
   GROUP BY source
   ORDER BY n DESC
`);
out.source_provenance = provenance.rows;

const lifecycle = await client.query(`
  SELECT bc.lifecycle_state, COUNT(*)::bigint AS n
    FROM nex.mp_seller mp
    JOIN nex.business_canonical bc ON bc.canonical_business_id = mp.canonical_business_id
   WHERE mp.canonical_business_id IS NOT NULL
   GROUP BY bc.lifecycle_state
   ORDER BY n DESC
`);
out.lifecycle_distribution_linked = lifecycle.rows;

const media = await client.query(`
  SELECT COUNT(DISTINCT bc.canonical_business_id)::bigint AS canonicals_with_media,
         (SELECT COUNT(*)::bigint FROM nex.business_canonical WHERE entity_type = 'marketplace_seller') AS canonicals_total
    FROM nex.business_canonical bc
   WHERE bc.entity_type = 'marketplace_seller'
     AND EXISTS (
       SELECT 1 FROM nex.business_media bm
        WHERE bm.canonical_business_id = bc.canonical_business_id
     )
`);
out.media_readiness = media.rows[0];

// Jurisdiction parse eligibility · the adapter rejects rows whose
// jurisdiction cannot yield an ISO-2 country prefix. Shape is
// 'ID/<prov>/<city>' per migration 096. Count rows with a well-formed
// prefix.
const jurisdiction = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE jurisdiction ~ '^[A-Z]{2}/.*')::bigint AS iso2_prefix_ok,
    COUNT(*) FILTER (WHERE jurisdiction !~ '^[A-Z]{2}/.*')::bigint AS iso2_prefix_bad,
    COUNT(*)::bigint AS n
    FROM nex.mp_seller
`);
out.jurisdiction_eligibility = jurisdiction.rows[0];

const eligibility = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE
      seller_id IS NOT NULL
      AND slug IS NOT NULL
      AND btrim(slug) <> ''
      AND display_name IS NOT NULL
      AND btrim(display_name) <> ''
      AND jurisdiction ~ '^[A-Z]{2}/.*'
    )::bigint AS projectable,
    COUNT(*)::bigint AS remaining
    FROM nex.mp_seller
   WHERE canonical_business_id IS NULL
`);
out.candidate_eligibility_estimate = eligibility.rows[0];
out.candidate_eligibility_note =
  "Projectable rows pass all adapter stages (seller_id, slug, display_name, jurisdiction ISO2). mp_seller has 3 source modes: osm_overpass (16,427 · ODbL), nominatim (1,893 · ODbL + Nominatim policy), null (5,260 · unknown provenance · DOES NOT BLOCK ingestion but DOES block publication-with-attribution).";

const registry = await client.query(`
  SELECT source_id, source_type, can_collect, can_store, can_display,
         can_derive, can_redistribute, attribution_required,
         attribution_template IS NOT NULL AS has_attribution_template,
         licence_id
    FROM nex.source_registry
   WHERE source_id = 'nex_mp_seller_legacy'
`);
out.source_registry = registry.rows[0] ?? null;

await client.end();
console.log(JSON.stringify(out, null, 2));
