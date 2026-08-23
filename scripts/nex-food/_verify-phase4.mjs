#!/usr/bin/env node
// Verify Phase 4 · run the same query the API route runs and print the
// FoodListing-shaped rows the UI would receive. No Next dev required.
import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

function mapClaimStatus(s) {
  if (s === "listed") return "unclaimed";
  if (s === "invited") return "invited";
  if (s === "claimed" || s === "paying") return "claimed";
  return null;
}

const PLACEHOLDER_HERO_BY_CATEGORY = {
  "coffee-cafe":       "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxcccdddddsssda-removebg-preview.png?updatedAt=1777019597797",
  "ice-cream-dessert": "https://ik.imagekit.io/nepgaxllc/odfss-removebg-preview.png?updatedAt=1777007894759",
  "fast-food":         "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssssddffdddd-removebg-preview.png?updatedAt=1777007292974",
  "restaurant":        "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddss-removebg-preview.png?updatedAt=1777019098200",
};

const r = await pool.query(`
  SELECT public_listing_ref, business_name, category, claim_status, district,
         phone, coordinates_lat, coordinates_lng, hero_image_url, hero_image_approved,
         source
  FROM nex.food_business
  WHERE city='Yogyakarta' AND claim_status IN ('listed','invited','claimed','paying')
  ORDER BY business_name
`);
console.log(`── /api/nex-food/listings would return: ${r.rowCount} listings ──\n`);

let osmSourced = 0;
r.rows.forEach((row) => {
  const claimStatus = mapClaimStatus(row.claim_status);
  const heroImage = row.hero_image_approved && row.hero_image_url
    ? row.hero_image_url
    : PLACEHOLDER_HERO_BY_CATEGORY[row.category];
  if (row.source?.startsWith("openstreetmap")) osmSourced++;
  console.log(`  ${row.public_listing_ref}  [${row.category.padEnd(18)}]  ${row.business_name}`);
  console.log(`      district=${row.district ?? "—"}  phone=${row.phone ?? "—"}  claim=${claimStatus}`);
  console.log(`      hero=${heroImage.slice(0, 70)}...`);
  console.log(`      source=${row.source}`);
  console.log();
});

console.log(`Attribution required: ${osmSourced > 0 ? "YES · Business data © OpenStreetMap contributors · ODbL" : "no"}`);

await pool.end();
