import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL });
const r = await pool.query(`
  SELECT public_listing_ref, business_name, category, city,
         coordinates_lat, coordinates_lng,
         whatsapp_number, phone, website,
         source, source_reference,
         claim_status, owner_status, created_by,
         source_ingested_at::text as ingested_at
  FROM nex.food_business
  WHERE created_by LIKE 'agent:universal-acquisition:%'
  ORDER BY public_listing_ref
`);
console.log("── VERIFICATION · records inserted by Universal Acquisition Engine ──");
console.log("  count:", r.rowCount);
for (const row of r.rows) {
  console.log("  " + row.public_listing_ref + "  " + (row.business_name||"").padEnd(30) + "  [" + row.category + "]  claim=" + row.claim_status + "  owner=" + row.owner_status);
  console.log("     coord=(" + row.coordinates_lat + "," + row.coordinates_lng + ")");
  console.log("     wa=" + (row.whatsapp_number||"-") + "  tel=" + (row.phone||"-"));
  console.log("     source=" + row.source + "  ref=" + row.source_reference);
  console.log("     created_by=" + row.created_by);
  console.log("     ingested=" + row.ingested_at);
}
const univ = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
console.log("");
console.log("── Universe ratio ──");
console.log("  DISCOVERY  :", univ.rows[0].discovery_universe);
console.log("  COMMERCIAL :", univ.rows[0].commercial_universe);
console.log("  RATIO      :", univ.rows[0].commercial_ratio);
await pool.end();