// scripts/nex-canonical/_card-probe.mjs
//
// Addendum confirmations · read-only probe against NEX_POSTGRES_URL.
// Scoped exactly to the 10 questions in the LISTING CARD + CHAT DIVERSION
// addendum. Zero writes.

import pg from "pg";

const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
await client.connect();
await client.query("SET default_transaction_read_only = on");

const out = {};
async function q(label, sql, params) {
  try {
    const r = await client.query(sql, params);
    out[label] = { ok: true, rows: r.rows };
  } catch (e) {
    out[label] = { ok: false, error: String(e.message || e).slice(0, 300) };
  }
}

// (1) business_canonical columns · confirms no description column + what 178 added.
await q("bc_columns", `
  SELECT column_name, data_type
    FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='business_canonical'
   ORDER BY ordinal_position;
`);

// (2) business_directory_v view column list.
await q("bdv_columns", `
  SELECT column_name, data_type
    FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='business_directory_v'
   ORDER BY ordinal_position;
`);

// (4) category_ids actually populated?
await q("bc_category_ids_populated", `
  SELECT COUNT(*)::bigint                                        AS total,
         COUNT(*) FILTER (WHERE category_ids <> '{}'::text[])::bigint AS have_cats,
         COUNT(*) FILTER (WHERE array_length(category_ids,1) IS NULL OR array_length(category_ids,1) = 0)::bigint AS no_cats
    FROM nex.business_canonical;
`);

// Sample category_ids content on real canonicals (name included for context).
await q("bc_sample_cats", `
  SELECT canonical_business_id, name_canonical, city, entity_type, category_ids
    FROM nex.business_canonical
   WHERE name_canonical <> 'SYNTH FOR BOOTSTRAP'
   ORDER BY name_canonical
   LIMIT 10;
`);

// (4b) category_registry size + sample.
await q("category_registry_size", `
  SELECT COUNT(*)::bigint AS n FROM nex.category_registry;
`);
await q("category_registry_sample", `
  SELECT * FROM nex.category_registry LIMIT 5;
`);

// (3b) category_image_library — can it serve as fallback?
await q("cat_img_lib_size", `
  SELECT COUNT(*)::bigint AS total,
         COUNT(*) FILTER (WHERE active)::bigint AS active_rows,
         COUNT(DISTINCT category_slug)::bigint AS distinct_slugs
    FROM nex.category_image_library;
`);
await q("cat_img_lib_slugs", `
  SELECT category_slug, COUNT(*)::bigint AS n
    FROM nex.category_image_library
   WHERE active = TRUE
   GROUP BY category_slug
   ORDER BY category_slug;
`);

// (3) business_media state.
await q("bm_state", `
  SELECT media_kind, COUNT(*)::bigint AS n
    FROM nex.business_media
   GROUP BY media_kind
   ORDER BY media_kind;
`);
await q("bm_columns", `
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='business_media' ORDER BY ordinal_position;
`);

// business_image (old migration 080) — still exists?
await q("bi_exists", `
  SELECT COUNT(*)::bigint AS n_rows,
         EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='nex' AND table_name='business_image') AS table_present
    FROM nex.business_image
   WHERE 1=0;
`);
// safer existence check that doesn't fail if table absent
await q("bi_table_present", `
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='nex' AND table_name='business_image') AS present;
`);

// (5) listing_thread + listing_message counts and listing_ref format usage.
await q("lt_counts", `
  SELECT COUNT(*)::bigint AS n_threads FROM nex.listing_thread;
`);
await q("lm_counts", `
  SELECT COUNT(*)::bigint AS n_messages FROM nex.listing_message;
`);
await q("lt_ref_prefixes", `
  SELECT split_part(listing_ref, ':', 1) AS prefix, COUNT(*)::bigint AS n
    FROM nex.listing_thread
   GROUP BY prefix
   ORDER BY prefix;
`);
await q("lt_status_check", `
  SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE nsp.nspname='nex' AND rel.relname='listing_thread' AND con.contype='c';
`);

// (6) listing_message from_role CHECK, verify 'system' allowed.
await q("lm_role_check", `
  SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE nsp.nspname='nex' AND rel.relname='listing_message' AND con.contype='c';
`);

// (8) listing_owner_invite exists + structure.
await q("loi_present", `
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='nex' AND table_name='listing_owner_invite') AS present,
         (SELECT COUNT(*)::bigint FROM nex.listing_owner_invite) AS n_rows;
`);

await client.end();
console.log(JSON.stringify(out, null, 2));
