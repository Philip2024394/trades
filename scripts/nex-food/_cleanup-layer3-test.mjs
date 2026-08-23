// Clean up test data left by _verify-layer3.mjs:
//   · Revert Lavana (#FL-2026-000SB) to discovered/unknown (it's a real OSM
//     business, we used it for a test — restore original state)
//   · Delete the fictional test warung (#FL-2026-000SC · "Warung Test Layer 3")
//   · Delete related claim_code rows and owner_verified provenance rows

import pg from "pg";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

console.log("── Cleaning up Layer 3 test data ──");

// Lavana · revert to pre-test state (still a real discovered OSM listing)
const revertLavana = await pool.query(`
  UPDATE nex.food_business
  SET claim_status='discovered', owner_status='unknown'
  WHERE public_listing_ref='#FL-2026-000SB'
    AND created_by LIKE 'agent:universal-acquisition:%'
  RETURNING business_name
`);
console.log(`  Lavana reverted to discovered/unknown: ${revertLavana.rowCount} row(s)`);

// Delete owner_verified provenance rows for Lavana (they were from a test claim)
const provDel = await pool.query(`
  DELETE FROM nex.food_business_field_provenance
  WHERE business_ref='#FL-2026-000SB'
    AND written_by LIKE 'claim:self_service_claim:%'
`);
console.log(`  Lavana test provenance rows deleted: ${provDel.rowCount}`);

// Delete Lavana's test claim code
const codeDel = await pool.query(`
  DELETE FROM nex.food_claim_code
  WHERE business_ref='#FL-2026-000SB'
    AND requested_by='owner:test_lavana'
`);
console.log(`  Lavana test claim codes deleted: ${codeDel.rowCount}`);

// Fictional test warung · delete entirely
const warungRefs = await pool.query(`
  SELECT public_listing_ref FROM nex.food_business
  WHERE business_name LIKE 'Warung Test Layer 3%'
`);
for (const r of warungRefs.rows) {
  await pool.query(`DELETE FROM nex.food_business_field_provenance WHERE business_ref=$1`, [r.public_listing_ref]);
  await pool.query(`DELETE FROM nex.food_claim_code WHERE business_ref=$1`, [r.public_listing_ref]);
  await pool.query(`DELETE FROM nex.food_business WHERE public_listing_ref=$1`, [r.public_listing_ref]);
  console.log(`  deleted test warung: ${r.public_listing_ref}`);
}

// Verify universe returns to baseline
const univ = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
console.log("");
console.log("── Universe after cleanup ──");
console.log(`  DISCOVERY:  ${univ.rows[0].discovery_universe}`);
console.log(`  COMMERCIAL: ${univ.rows[0].commercial_universe}`);
console.log(`  RATIO:      ${univ.rows[0].commercial_ratio ? (Number(univ.rows[0].commercial_ratio)*100).toFixed(2)+"%" : "n/a"}`);

await pool.end();
