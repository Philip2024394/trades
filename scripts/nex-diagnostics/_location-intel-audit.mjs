#!/usr/bin/env node
// Location Intelligence · schema + real-data audit · read-only

import pg from "pg";

const YOG_BBOX = { minLat: -8.05, maxLat: -7.55, minLng: 110.15, maxLng: 110.60 };
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

async function locationColumns(table) {
  const r = await pool.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='nex' AND table_name=$1
        AND (column_name LIKE '%coord%' OR column_name LIKE '%address%'
             OR column_name LIKE '%district%' OR column_name LIKE '%location%'
             OR column_name LIKE '%geo%' OR column_name LIKE '%pin%'
             OR column_name IN ('city','country','neighbourhood','street',
                                'last_verified_at','verification_source','source'))
      ORDER BY ordinal_position`,
    [table],
  );
  return r.rows;
}

async function pinQuality(table) {
  const r = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL)::int AS with_coords,
       COUNT(*) FILTER (WHERE coordinates_lat = 0 AND coordinates_lng = 0)::int AS null_island,
       COUNT(*) FILTER (WHERE address IS NOT NULL AND length(trim(address)) > 0)::int AS with_address,
       COUNT(*) FILTER (WHERE address ~ '\d')::int AS address_has_number,
       COUNT(*) FILTER (WHERE district IS NOT NULL AND length(trim(district)) > 0)::int AS with_district,
       COUNT(*) FILTER (WHERE coordinates_lat BETWEEN $1 AND $2 AND coordinates_lng BETWEEN $3 AND $4)::int AS in_yog_bbox,
       COUNT(DISTINCT district)::int AS distinct_districts,
       COUNT(DISTINCT source)::int AS distinct_sources,
       COUNT(*) FILTER (WHERE last_verified_at IS NOT NULL)::int AS with_verify_ts
     FROM nex.${table} WHERE city='Yogyakarta'`,
    [YOG_BBOX.minLat, YOG_BBOX.maxLat, YOG_BBOX.minLng, YOG_BBOX.maxLng],
  );
  return r.rows[0];
}

async function outOfBboxSample(table) {
  const r = await pool.query(
    `SELECT business_name, coordinates_lat::float AS lat, coordinates_lng::float AS lng, address, district
       FROM nex.${table}
      WHERE city='Yogyakarta'
        AND coordinates_lat IS NOT NULL
        AND NOT (coordinates_lat BETWEEN $1 AND $2 AND coordinates_lng BETWEEN $3 AND $4)
      LIMIT 5`,
    [YOG_BBOX.minLat, YOG_BBOX.maxLat, YOG_BBOX.minLng, YOG_BBOX.maxLng],
  );
  return r.rows;
}

async function provenanceCoverage(table) {
  const provTable = table.replace("_business", "_business_field_provenance");
  const r = await pool.query(
    `SELECT field_name, COUNT(*)::int AS n
       FROM nex.${provTable}
      WHERE field_name IN ('coordinates_lat','coordinates_lng','address','district','city','country')
      GROUP BY field_name ORDER BY n DESC`,
  );
  return r.rows;
}

async function confidenceBucketProxy(table) {
  // v0.1 proxy rules (no schema change · derived from existing columns):
  //   EXACT   = coords valid + in bbox + ≥5 dp precision + address has street number + district
  //   STREET  = coords valid + in bbox + ≥5 dp precision + address populated (no # required)
  //   AREA    = coords valid + in bbox + district populated
  //   CITY    = coords valid but out of bbox OR bbox-only with no district/address
  //   UNKNOWN = no coords
  const r = await pool.query(
    `WITH b AS (
       SELECT
         (coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL) AS has_coord,
         (coordinates_lat BETWEEN $1 AND $2 AND coordinates_lng BETWEEN $3 AND $4) AS in_bbox,
         (length(split_part(coordinates_lat::text,'.',2)) >= 5
          AND length(split_part(coordinates_lng::text,'.',2)) >= 5) AS precise,
         (address IS NOT NULL AND length(trim(address)) > 0) AS has_addr,
         (address ~ '\d') AS addr_has_num,
         (district IS NOT NULL AND length(trim(district)) > 0) AS has_district
         FROM nex.${table} WHERE city='Yogyakarta'
     )
     SELECT
       COUNT(*) FILTER (WHERE has_coord AND in_bbox AND precise AND addr_has_num AND has_district)::int AS EXACT_,
       COUNT(*) FILTER (WHERE has_coord AND in_bbox AND precise AND has_addr AND NOT (addr_has_num AND has_district))::int AS STREET_,
       COUNT(*) FILTER (WHERE has_coord AND in_bbox AND has_district AND NOT (precise AND has_addr))::int AS AREA_,
       COUNT(*) FILTER (WHERE has_coord AND (NOT in_bbox OR (NOT has_district AND NOT has_addr)))::int AS CITY_,
       COUNT(*) FILTER (WHERE NOT has_coord)::int AS UNKNOWN_,
       COUNT(*)::int AS TOTAL_
     FROM b`,
    [YOG_BBOX.minLat, YOG_BBOX.maxLat, YOG_BBOX.minLng, YOG_BBOX.maxLng],
  );
  return r.rows[0];
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║  DIAGNOSTIC · LOCATION INTELLIGENCE · read-only · no writes       ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  for (const t of ["food_business", "accommodation_business"]) {
    console.log(`════════════════════════════════════════════════════════════`);
    console.log(`TABLE: nex.${t}`);
    console.log(`════════════════════════════════════════════════════════════`);
    console.log("Location-related columns:");
    for (const c of await locationColumns(t)) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);
    console.log("\nField-level provenance coverage (from *_field_provenance):");
    const prov = await provenanceCoverage(t);
    if (prov.length === 0) console.log("  (no provenance rows yet)");
    for (const p of prov) console.log(`  ${p.field_name.padEnd(20)} ${p.n} rows`);
    console.log("\nPin quality distribution (Yogyakarta):");
    const q = await pinQuality(t);
    console.log(`  total                 ${q.total}`);
    console.log(`  with_coords           ${q.with_coords} (${(100*q.with_coords/q.total).toFixed(1)}%)`);
    console.log(`  null_island (0,0)     ${q.null_island}`);
    console.log(`  in_yog_bbox           ${q.in_yog_bbox} (${(100*q.in_yog_bbox/q.total).toFixed(1)}%)`);
    console.log(`  with_address          ${q.with_address} (${(100*q.with_address/q.total).toFixed(1)}%)`);
    console.log(`  address_has_number    ${q.address_has_number} (${(100*q.address_has_number/q.total).toFixed(1)}%)`);
    console.log(`  with_district         ${q.with_district} (${(100*q.with_district/q.total).toFixed(1)}%)`);
    console.log(`  distinct_districts    ${q.distinct_districts}`);
    console.log(`  distinct_sources      ${q.distinct_sources}`);
    console.log(`  with_verify_ts        ${q.with_verify_ts}`);
    console.log("\nOut-of-bbox sample (candidates for SAFETY_COORD_OUT_OF_CITY or CITY-only state):");
    const oob = await outOfBboxSample(t);
    if (oob.length === 0) console.log("  (none)");
    for (const r of oob) console.log(`  ${r.business_name || '?'} · ${r.lat},${r.lng} · ${r.address || '-'} · ${r.district || '-'}`);
    console.log("\nProposed confidence-state bucket counts (v0.1 proxy rules):");
    const bk = await confidenceBucketProxy(t);
    const total = bk.total_;
    for (const s of ["exact_","street_","area_","city_","unknown_"]) {
      const label = s.replace("_","").toUpperCase();
      const v = bk[s];
      const pct = total > 0 ? (100*v/total).toFixed(1) : "0.0";
      console.log(`  ${label.padEnd(8)} ${String(v).padStart(4)}   ${pct}%`);
    }
    console.log();
  }

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
