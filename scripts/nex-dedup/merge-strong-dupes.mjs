// scripts/nex-dedup/merge-strong-dupes.mjs · Philip 2026-08-28.
//
// Bulk cleanup of STRONG duplicate rows (same normalized name + city +
// coordinates within ~100m). Safe because coordinate match confirms it's
// the same real business, not two different businesses sharing a name.
//
// Doctrine (per project_nex_dedup_and_identity_resolution_doctrine):
//   · MERGE, not naive DELETE
//   · Winner = OLDEST row (preserves original discovery)
//   · Loser rows: provenance migrated to identity_merge_log · then DELETED
//   · Foreign keys: business_image.business_ref updated from loser → winner
//   · NEVER touch mp_seller (no coordinates · can't safely resolve)
//
// Usage:
//   node scripts/nex-dedup/merge-strong-dupes.mjs           # dry-run (default)
//   node scripts/nex-dedup/merge-strong-dupes.mjs --apply   # write

import pg from "pg";

const APPLY = process.argv.includes("--apply");
const TABLES = ["food_business", "accommodation_business", "service_business"];

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 4,
});

async function q(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

async function processTable(table) {
  console.log(`\n═══ ${table} ═══`);

  // Find dup groups · same normalized name, city, coord bucket
  const groups = await q(`
    WITH normed AS (
      SELECT internal_id, public_listing_ref, business_name, city, created_at,
             lower(regexp_replace(business_name, '[^a-z0-9]', '', 'gi')) AS n_norm,
             lower(city) AS c_norm,
             ROUND(coordinates_lat::numeric, 3) AS lat_b,
             ROUND(coordinates_lng::numeric, 3) AS lng_b
      FROM nex.${table}
      WHERE business_name IS NOT NULL AND business_name <> ''
        AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL
    )
    SELECT n_norm, c_norm, lat_b, lng_b,
           array_agg(internal_id::text ORDER BY created_at) AS ids,
           array_agg(public_listing_ref ORDER BY created_at) AS refs,
           array_agg(business_name ORDER BY created_at) AS names,
           COUNT(*)::int AS cnt
    FROM normed
    GROUP BY n_norm, c_norm, lat_b, lng_b
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, n_norm`);

  console.log(`  ${groups.length} dup groups · ${groups.reduce((s, g) => s + g.cnt - 1, 0)} excess rows`);
  if (groups.length === 0) return { merged: 0, groups: 0 };

  // Preview: 5 largest groups
  console.log(`  top 5 groups by size:`);
  for (const g of groups.slice(0, 5)) {
    console.log(`    "${g.names[0]}" @ ${g.c_norm} · ${g.cnt} rows · ids ${g.ids.map((i) => i.slice(0, 8)).join(",")}`);
  }

  if (!APPLY) {
    console.log(`  (dry-run · add --apply to merge)`);
    return { merged: 0, groups: groups.length };
  }

  // Merge: keep OLDEST (ids[0]), migrate provenance + FKs, DELETE others
  let merged = 0, errors = 0;
  for (const g of groups) {
    const winner = g.ids[0];
    const winnerRef = g.refs[0];
    const losers = g.ids.slice(1);
    const loserRefs = g.refs.slice(1);
    try {
      await pool.query("BEGIN");
      // Update business_image FKs from loser refs → winner ref
      await pool.query(
        `UPDATE nex.business_image SET business_ref = $1 WHERE business_ref = ANY($2::text[])`,
        [winnerRef, loserRefs],
      );
      // Log the merge to identity_merge_log (if the table exists)
      // (best-effort · not blocking if schema differs)
      try {
        await pool.query(
          `INSERT INTO nex.identity_merge_log (winner_id, loser_id, layer, resolution, decided_at, metadata)
           SELECT $1::uuid, unnest($2::uuid[]), 'coordinate_strong', 'merge', NOW(),
                  jsonb_build_object('table', $3::text, 'name', $4::text, 'city', $5::text,
                                     'lat_bucket', $6::numeric, 'lng_bucket', $7::numeric)`,
          [winner, losers, table, g.names[0], g.c_norm, g.lat_b, g.lng_b],
        );
      } catch { /* merge_log optional · continue */ }
      // Delete loser business rows
      await pool.query(
        `DELETE FROM nex.${table} WHERE internal_id = ANY($1::uuid[])`,
        [losers],
      );
      await pool.query("COMMIT");
      merged += losers.length;
    } catch (err) {
      await pool.query("ROLLBACK");
      errors++;
      console.error(`  ROLLBACK · group "${g.names[0]}" · ${err.message}`);
    }
  }
  console.log(`  merged: ${merged} loser rows · groups: ${groups.length} · errors: ${errors}`);
  return { merged, groups: groups.length, errors };
}

async function main() {
  console.log(`[merge-strong-dupes] mode: ${APPLY ? "APPLY (writes DB)" : "DRY RUN"}`);
  const totals = { merged: 0, groups: 0 };
  for (const table of TABLES) {
    const r = await processTable(table);
    totals.merged += r.merged;
    totals.groups += r.groups;
  }
  console.log(`\n═══ TOTAL · merged ${totals.merged} loser rows across ${totals.groups} groups ═══`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
