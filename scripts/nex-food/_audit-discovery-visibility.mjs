import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL });
const stateCounts = await pool.query(`SELECT claim_status, count(*)::int AS n FROM nex.food_business WHERE city='Yogyakarta' GROUP BY claim_status ORDER BY claim_status`);
console.log("── nex.food_business by claim_status (Yogyakarta) ──");
for (const r of stateCounts.rows) console.log(`  ${r.claim_status.padEnd(12)} ${r.n}`);
const visibleTotal = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE city='Yogyakarta' AND claim_status IN ('listed','invited','claimed','paying')`);
const discoveredCount = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE city='Yogyakarta' AND claim_status='discovered'`);
console.log("");
console.log("── Visibility gap ──");
console.log("  Currently visible on /food:  " + visibleTotal.rows[0].n + " (query filter: claim_status IN listed/invited/claimed/paying)");
console.log("  Discovered (hidden from /food): " + discoveredCount.rows[0].n);
console.log("");
const prambanan = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE created_by LIKE 'agent:universal-acquisition:%prambanan%'`);
const kaliurang = await pool.query(`SELECT count(*)::int AS n FROM nex.food_business WHERE created_by LIKE 'agent:universal-acquisition:%kaliurang%'`);
console.log("── Walker's inserts (by cycle) ──");
console.log("  Prambanan cycle:  " + prambanan.rows[0].n + " records (all at claim_status='discovered')");
console.log("  Kaliurang cycle:  " + kaliurang.rows[0].n + " records (all at claim_status='discovered')");
console.log("");
// Sample of discovered records with what fields they have
const sample = await pool.query(`
  SELECT public_listing_ref, business_name, category, city, district, address,
         (whatsapp_number IS NOT NULL) AS has_wa,
         (phone IS NOT NULL) AS has_phone,
         (website IS NOT NULL) AS has_web,
         (coordinates_lat IS NOT NULL) AS has_coord,
         source, source_licence_terms
  FROM nex.food_business
  WHERE claim_status='discovered' AND city='Yogyakarta'
  ORDER BY source_ingested_at DESC LIMIT 5
`);
console.log("── Sample discovered records (first 5) ──");
for (const r of sample.rows) {
  console.log(`  ${r.public_listing_ref}  ${(r.business_name||"").slice(0,40).padEnd(40)}  [${r.category}]  wa=${r.has_wa?"Y":"n"} tel=${r.has_phone?"Y":"n"} web=${r.has_web?"Y":"n"} coord=${r.has_coord?"Y":"n"}`);
  console.log(`      addr: ${r.address || "(none)"}`);
  console.log(`      source: ${r.source}  licence: ${(r.source_licence_terms||"").slice(0,50)}`);
}
await pool.end();