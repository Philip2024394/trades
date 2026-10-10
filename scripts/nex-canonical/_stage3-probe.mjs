// scripts/nex-canonical/_stage3-probe.mjs
// Stage 3 close-out probes · read-only · local nex_dev.
//   #13 · 172 (business_freshness_band + view) · 177 (walker source_id FKs) · 183 (DP-3 grants)
//   #6  · category_registry contents (is it actually seeded?)
//   #11 · deep-fill on the 7 real canonical food rows (what crawl would / would not add)

import pg from "pg";
const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
await client.connect();
await client.query("SET default_transaction_read_only = on");
const out = {};
const q = async (label, sql, params) => {
  try { out[label] = { ok: true, rows: (await client.query(sql, params)).rows }; }
  catch (e) { out[label] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
};

// === 172 · freshness band fn + freshness_v view ===
await q("fn_172_freshness_band_exists", `
  SELECT p.proname, pg_get_function_arguments(p.oid) AS args,
         pg_get_function_result(p.oid)              AS ret,
         p.provolatile
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='nex' AND p.proname='business_freshness_band';
`);
// Call it to prove it works (pure fn, no side effect).
await q("fn_172_freshness_band_call", `
  SELECT nex.business_freshness_band(now() - interval '6 months')  AS six_mo,
         nex.business_freshness_band(now() - interval '14 months') AS fourteen_mo,
         nex.business_freshness_band(now() - interval '20 months') AS twenty_mo,
         nex.business_freshness_band(now() - interval '30 months') AS thirty_mo,
         nex.business_freshness_band(NULL)                         AS null_input;
`);
await q("view_172_freshness_v_exists", `
  SELECT table_name FROM information_schema.views
   WHERE table_schema='nex' AND table_name='business_freshness_v';
`);
// If present, sample it on the 8 canonicals.
await q("view_172_freshness_v_sample", `
  SELECT * FROM nex.business_freshness_v
   ORDER BY entity_type, country, canonical_business_id
   LIMIT 10;
`);

// === 177 · walker-attribution tables now carry source_id (added by 177)? ===
// 177 header says it ADDs source_id to 4 walker-attribution tables added in
// migrations 105/106/107/110. Probe each.
await q("walker_source_id_columns", `
  SELECT table_name,
         bool_or(column_name='source_id')  AS has_source_id,
         COUNT(*)                          AS total_columns
    FROM information_schema.columns
   WHERE table_schema='nex'
     AND table_name IN (
       'walker_attribution_cycle','walker_attribution_run',
       'walker_attribution_source','walker_attribution_entity'
     )
   GROUP BY table_name
   ORDER BY table_name;
`);
// Fallback · enumerate all nex.* tables with 'walker' in the name to find the actual 4.
await q("walker_tables_all", `
  SELECT table_name FROM information_schema.tables
   WHERE table_schema='nex' AND table_name LIKE 'walker%'
   ORDER BY table_name;
`);

// === 183 · DP-3 GRANT/REVOKE state ===
await q("grants_business_canonical", `
  SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
   WHERE table_schema='nex' AND table_name='business_canonical'
   ORDER BY grantee, privilege_type;
`);
await q("grants_business_directory_v", `
  SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
   WHERE table_schema='nex' AND table_name='business_directory_v'
   ORDER BY grantee, privilege_type;
`);
await q("roles_present", `
  SELECT rolname FROM pg_roles
   WHERE rolname IN ('nex_directory_reader','nex_app_runtime','directory_reader')
   ORDER BY rolname;
`);

// === #6 · category_registry contents ===
await q("category_registry_shape", `
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='category_registry' ORDER BY ordinal_position;
`);
await q("category_registry_rows", `
  SELECT id, parent_vertical, display_name_en, active, countries, business_table, category_filter
    FROM nex.category_registry
   ORDER BY parent_vertical, id;
`);
await q("category_registry_by_vertical", `
  SELECT parent_vertical, COUNT(*)::bigint AS n_total,
         COUNT(*) FILTER (WHERE active)::bigint AS n_active
    FROM nex.category_registry GROUP BY parent_vertical ORDER BY parent_vertical;
`);

// === #11 · deep-fill on the 7 real canonicals (and the 1 synthetic) ===
// Join canonical to its first evidence row and the backing food_business row.
await q("canonical_fill_profile", `
  SELECT bc.canonical_business_id,
         bc.name_canonical,
         bc.city,
         bc.entity_type,
         bc.lifecycle_state,
         bc.phone_e164   IS NOT NULL                            AS has_phone_canonical,
         bc.website_apex IS NOT NULL                            AS has_website_canonical,
         bc.coordinates  IS NOT NULL                            AS has_coords_canonical,
         bc.address      IS NOT NULL                            AS has_address_canonical,
         bc.street_line  IS NOT NULL                            AS has_street_line_canonical,
         bc.district     IS NOT NULL                            AS has_district_canonical,
         bc.neighbourhood IS NOT NULL                           AS has_neighbourhood_canonical,
         array_length(bc.category_ids, 1)                       AS n_category_ids,
         bc.last_verified_at
    FROM nex.business_canonical bc
   ORDER BY bc.name_canonical;
`);

await client.end();
console.log(JSON.stringify(out, null, 2));
