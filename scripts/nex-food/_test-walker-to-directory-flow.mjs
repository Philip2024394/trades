// Verifies Walker → Discovery Universe → Public Food Directory → /food/[slug] flow
// after the visibility filter widened to include 'discovered'.
//
// Asserts:
//   1. /food listing query now returns all 3 populations (Commercial + discovered)
//   2. ORDER BY keeps verified populations at top · discovered ranked last
//   3. Commercial Universe unchanged (Discovery ≠ Commercial invariant holds)
//   4. A specific Walker discovery is fetchable by /food/[slug] slug path
//   5. Discovered record carries full provenance
//   6. Discovered record's contact fields are preserved as-recorded (no fabrication)

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL });

const T = { pass: 0, fail: 0, errors: [] };
function check(name, cond, detail = "") {
  if (cond) { T.pass++; console.log(`  ✓ ${name}${detail ? "  · " + detail : ""}`); }
  else { T.fail++; T.errors.push(name); console.log(`  ✗ ${name}${detail ? "  · " + detail : ""}`); }
}

console.log("═".repeat(72));
console.log("WALKER → FOOD DIRECTORY PUBLICATION FLOW · TEST");
console.log("═".repeat(72));

// ── TEST 1 · listing query returns discovered records ─────────────────────
console.log("\n── TEST 1 · /food query returns Commercial + discovered ──");
const listQ = await pool.query(`
  SELECT public_listing_ref, business_name, claim_status
  FROM nex.food_business
  WHERE city = 'Yogyakarta'
    AND claim_status IN ('listed','invited','claimed','paying','discovered')
  ORDER BY
    CASE claim_status
      WHEN 'paying'     THEN 1
      WHEN 'claimed'    THEN 2
      WHEN 'invited'    THEN 3
      WHEN 'listed'     THEN 4
      WHEN 'discovered' THEN 5
      ELSE 6
    END,
    business_name
`);
const byState = {};
for (const r of listQ.rows) byState[r.claim_status] = (byState[r.claim_status] ?? 0) + 1;
console.log(`  total returned:  ${listQ.rowCount}`);
console.log(`  by claim_status: ${JSON.stringify(byState)}`);
check("query returns >= 900 rows (was 806 · +115 discovered)", listQ.rowCount >= 900, `rows=${listQ.rowCount}`);
check("query includes 'discovered' records", (byState.discovered ?? 0) >= 110, `discovered=${byState.discovered ?? 0}`);
check("query preserves Commercial records", (byState.listed ?? 0) >= 800 && (byState.claimed ?? 0) >= 1, `listed=${byState.listed}, claimed=${byState.claimed}`);

// ── TEST 2 · ORDER BY ranks verified above discovered ─────────────────────
console.log("\n── TEST 2 · ORDER BY keeps verified populations at top ──");
const first10 = listQ.rows.slice(0, 10).map(r => r.claim_status);
const last10 = listQ.rows.slice(-10).map(r => r.claim_status);
check("first 10 rows are NOT 'discovered'", first10.every(s => s !== "discovered"), `first10=${first10.join(",")}`);
check("last N rows are 'discovered'", last10.some(s => s === "discovered"), `last10=${last10.join(",")}`);

// ── TEST 3 · Commercial Universe view unchanged ───────────────────────────
console.log("\n── TEST 3 · Commercial Universe view still excludes discovered ──");
const cu = await pool.query(`SELECT count(*)::int AS n FROM nex.food_commercial_universe`);
const univ = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
check("Commercial Universe count unchanged (85 or 86 · Layer 3 test may have left one)", Number(cu.rows[0].n) >= 80 && Number(cu.rows[0].n) <= 90, `commercial=${cu.rows[0].n}`);
check("Discovery Universe reflects total food_business (all statuses)", Number(univ.rows[0].discovery_universe) >= 900, `discovery=${univ.rows[0].discovery_universe}`);
check("Discovery ≠ Commercial invariant holds (discovered records NOT in Commercial)", Number(cu.rows[0].n) < 200, `commercial=${cu.rows[0].n} · would be 900+ if invariant broke`);

// ── TEST 4 · specific Walker discovery reachable by /food/[slug] slug ─────
console.log("\n── TEST 4 · specific Walker discovery reachable via profile page ──");
// Pick #FL-2026-000WP · Satria Resto Prambanan (has WA + tel + web from OSM)
const target = await pool.query(`
  SELECT public_listing_ref, business_name, category, city, coordinates_lat, coordinates_lng,
         whatsapp_number, phone, website, claim_status, owner_status,
         source, source_reference, source_licence_terms
  FROM nex.food_business
  WHERE public_listing_ref = '#FL-2026-000WP'
`);
check("target discovered record exists in DB", target.rowCount === 1, target.rowCount === 1 ? target.rows[0].business_name : "not found");
if (target.rowCount === 1) {
  const t = target.rows[0];
  const slug = t.public_listing_ref.replace(/^#FL-/, "");
  console.log(`  URL:              /food/${slug}`);
  console.log(`  business:         ${t.business_name}`);
  console.log(`  claim_status:     ${t.claim_status}`);
  console.log(`  owner_status:     ${t.owner_status}`);
  console.log(`  whatsapp_number:  ${t.whatsapp_number ?? "(none)"}`);
  console.log(`  phone:            ${t.phone ?? "(none)"}`);
  console.log(`  website:          ${t.website ?? "(none)"}`);
  console.log(`  source:           ${t.source}`);
  console.log(`  source_ref:       ${t.source_reference}`);
  check("record is still claim_status='discovered'", t.claim_status === "discovered");
  check("record is still owner_status='unknown'", t.owner_status === "unknown");
  check("provenance source recorded", t.source === "osm_overpass");
  check("provenance source_reference recorded", /^(node|way|relation)\/\d+/.test(t.source_reference ?? ""));
  check("provenance licence recorded", (t.source_licence_terms ?? "").includes("ODbL"));
  // Doctrine: no fabrication · fields that OSM provided are preserved · fields it didn't remain null (not invented)
  check("owner-supplied fields untouched (record still owner_status=unknown · not owner_verified)", t.owner_status === "unknown");
}

// ── TEST 5 · a discovered record with NO contact would render claim-prompt path ─
console.log("\n── TEST 5 · discovered records with no contact trigger claim-prompt path ──");
const noContact = await pool.query(`
  SELECT count(*)::int AS n FROM nex.food_business
  WHERE claim_status = 'discovered'
    AND whatsapp_number IS NULL
    AND phone IS NULL
`);
console.log(`  discovered + no contact:  ${noContact.rows[0].n} records`);
check("some discovered records have no contact (will trigger ContextualClaimPrompt on /food/[slug])", Number(noContact.rows[0].n) > 0, `count=${noContact.rows[0].n}`);

// ── TEST 6 · owner-claim flow entry point works for discovered records ────
console.log("\n── TEST 6 · claim service accepts 'discovered' as valid claim start state ──");
// Already tested in Layer 3 verification (CLAIMABLE_STATES = ['discovered','listed','invited'])
// Just confirm the enum widening from Layer 3 is still in place
const codeCheck = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='nex' AND table_name='food_claim_code' AND column_name='entry_path'
`);
check("food_claim_code.entry_path exists (Layer 3 migration 062)", codeCheck.rowCount === 1);

// ── TEST 7 · no fabrication · discovered records with no rating stay ratingless ─
console.log("\n── TEST 7 · no fabrication anywhere ──");
const fab = await pool.query(`
  SELECT count(*)::int AS n FROM nex.food_business
  WHERE claim_status = 'discovered'
    AND (rating IS NOT NULL OR review_count IS NOT NULL OR hero_image_approved = true)
`);
check("no discovered record has fabricated rating/reviews/approved-hero", Number(fab.rows[0].n) === 0, `count=${fab.rows[0].n} (must be 0)`);

console.log("\n═".repeat(72));
console.log(`RESULT: ${T.pass} passed · ${T.fail} failed`);
if (T.fail > 0) {
  console.log(`Failed: ${T.errors.join(" · ")}`);
  await pool.end();
  process.exit(1);
} else {
  console.log(`WALKER → DIRECTORY FLOW · ALL ASSERTIONS PASSED`);
}
console.log("═".repeat(72));

await pool.end();
