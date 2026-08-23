// Walker Freshness Doctrine · 8 assertions from Philip 2026-08-21 spec.
//
// Self-cleaning · uses test-fixture rows · reverts all changes at exit.
// Never touches real Walker data or real owner-verified records.

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL });

const T = { pass: 0, fail: 0, errors: [] };
function check(name, cond, detail = "") {
  if (cond) { T.pass++; console.log(`  ✓ ${name}${detail ? "  · " + detail : ""}`); }
  else { T.fail++; T.errors.push(name); console.log(`  ✗ ${name}${detail ? "  · " + detail : ""}`); }
}

console.log("═".repeat(72));
console.log("WALKER FRESHNESS DOCTRINE · TEST");
console.log("═".repeat(72));

// Test fixture refs (won't collide with real records)
// Use year 9999 + valid Crockford Base32 suffixes ([A-HJ-KM-NP-TV-Z0-9]) so
// fixtures pass the public_listing_ref format constraint. All 5-char suffixes.
const REFS = {
  discovered3yo:  "#FL-9999-TST01",   // 3-year-old OSM record just discovered
  fresh6mo:       "#FL-9999-TST02",   // 6mo-old verification
  aging13mo:      "#FL-9999-TST03",   // 13mo-old verification
  expired25mo:    "#FL-9999-TST04",   // 25mo-old verification
  unverified:     "#FL-9999-TST05",   // never verified
  ownerVerified:  "#FL-9999-TST06",   // owner OTP verified today
};

// Cleanup any prior test rows
for (const ref of Object.values(REFS)) {
  await pool.query(`DELETE FROM nex.food_business WHERE public_listing_ref = $1`, [ref]);
}

async function seed(ref, opts) {
  await pool.query(
    `INSERT INTO nex.food_business (
       public_listing_ref, business_name, category, city,
       source, source_reference, source_ingested_at, source_licence_terms, dedupe_hash,
       source_updated_at, last_verified_at, verification_source,
       claim_status, owner_status, created_by
     ) VALUES (
       $1, $2, 'restaurant', 'Yogyakarta',
       'osm_overpass', $3, now(), 'test', $4,
       $5, $6, $7,
       $8, $9, 'test:_test-freshness-doctrine'
     )`,
    [ref, opts.name, `node/test-${ref}`, `test-${ref}`, opts.sourceUpdatedAt, opts.lastVerifiedAt,
     opts.verificationSource, opts.claimStatus ?? "listed", opts.ownerStatus ?? "unknown"]
  );
}

const NOW = new Date();
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const monthsAgo = (n) => daysAgo(n * 30);

// ── Seed fixtures ─────────────────────────────────────────────────────────
console.log("\n── seeding test fixtures ──");
// KEY TEST: 3-year-old source record just discovered TODAY.
// Discovery date = today · source_updated_at = 3 years ago · last_verified_at
// seeded from source_updated_at (not from now()). Must be EXPIRED.
await seed(REFS.discovered3yo, {
  name: "Test 3yo Discovery",
  sourceUpdatedAt: monthsAgo(36),
  lastVerifiedAt: monthsAgo(36),
  verificationSource: "osm_element_timestamp",
  claimStatus: "discovered",
});
await seed(REFS.fresh6mo, {
  name: "Test 6mo Fresh",
  sourceUpdatedAt: monthsAgo(6),
  lastVerifiedAt: monthsAgo(6),
  verificationSource: "osm_element_timestamp",
});
await seed(REFS.aging13mo, {
  name: "Test 13mo Aging",
  sourceUpdatedAt: monthsAgo(13),
  lastVerifiedAt: monthsAgo(13),
  verificationSource: "osm_element_timestamp",
});
await seed(REFS.expired25mo, {
  name: "Test 25mo Expired",
  sourceUpdatedAt: monthsAgo(25),
  lastVerifiedAt: monthsAgo(25),
  verificationSource: "osm_element_timestamp",
});
await seed(REFS.unverified, {
  name: "Test Unverified",
  sourceUpdatedAt: null,
  lastVerifiedAt: null,
  verificationSource: null,
});
await seed(REFS.ownerVerified, {
  name: "Test Owner OTP Verified",
  sourceUpdatedAt: monthsAgo(48),   // OSM element ancient
  lastVerifiedAt: NOW,               // BUT owner OTP verified today · fresh
  verificationSource: "owner_otp",
  claimStatus: "claimed",
  ownerStatus: "verified",
});
console.log(`  seeded ${Object.keys(REFS).length} fixtures`);

// ── ASSERTION 1 · newly discovered 3-year-old source record NOT fresh ────
console.log("\n── ASSERTION 1 · 3-year-old source record NOT auto-fresh ──");
{
  const r = await pool.query(
    `SELECT freshness_status, freshness_days FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.discovered3yo]
  );
  const fs = r.rows[0].freshness_status;
  const fd = r.rows[0].freshness_days;
  check("3yo-source record NOT classified as FRESH", fs !== "FRESH", `got ${fs} · ${fd} days`);
  check("3yo-source record correctly classified EXPIRED", fs === "EXPIRED", `got ${fs}`);
}

// ── ASSERTION 2 · 6mo verification is FRESH ──────────────────────────────
console.log("\n── ASSERTION 2 · 6mo verification = FRESH ──");
{
  const r = await pool.query(
    `SELECT freshness_status, freshness_days FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.fresh6mo]
  );
  check("6mo record classified FRESH", r.rows[0].freshness_status === "FRESH", `got ${r.rows[0].freshness_status} · ${r.rows[0].freshness_days} days`);
}

// ── ASSERTION 3 · 13mo verification is AGING ─────────────────────────────
console.log("\n── ASSERTION 3 · 13mo verification = AGING ──");
{
  const r = await pool.query(
    `SELECT freshness_status, freshness_days FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.aging13mo]
  );
  check("13mo record classified AGING", r.rows[0].freshness_status === "AGING", `got ${r.rows[0].freshness_status} · ${r.rows[0].freshness_days} days`);
}

// ── ASSERTION 4 · 25mo verification is EXPIRED ───────────────────────────
console.log("\n── ASSERTION 4 · 25mo verification = EXPIRED ──");
{
  const r = await pool.query(
    `SELECT freshness_status, freshness_days FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.expired25mo]
  );
  check("25mo record classified EXPIRED", r.rows[0].freshness_status === "EXPIRED", `got ${r.rows[0].freshness_status} · ${r.rows[0].freshness_days} days`);
}

// ── ASSERTION 5 · discovery date cannot masquerade as verification date ──
console.log("\n── ASSERTION 5 · discovery date ≠ verification date ──");
{
  // The 3yo-source fixture has source_ingested_at=now() (freshly discovered)
  // but source_updated_at=3yo (from OSM). The freshness system MUST derive
  // from source_updated_at → last_verified_at, NOT from source_ingested_at.
  const r = await pool.query(
    `SELECT source_ingested_at, source_updated_at, last_verified_at, freshness_status
     FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.discovered3yo]
  );
  const ingested = new Date(r.rows[0].source_ingested_at);
  const verified = new Date(r.rows[0].last_verified_at);
  const daysBetween = (ingested.getTime() - verified.getTime()) / (86400 * 1000);
  check("source_ingested_at ≠ last_verified_at (discovery date not used)", Math.abs(daysBetween) > 1000, `gap=${Math.round(daysBetween)} days`);
  check("freshness reflects the OSM update date, not the discovery date", r.rows[0].freshness_status === "EXPIRED", `status=${r.rows[0].freshness_status}`);
}

// ── ASSERTION 6 · expired records blocked from a fresh-only universe ─────
console.log("\n── ASSERTION 6 · expired records blocked from 'currently operating' presentation ──");
{
  // Simulate a fresh-only universe query (what Commercial Universe would look
  // like with a freshness filter added). Assert expired fixture doesn't pass.
  const freshOnly = await pool.query(`
    SELECT count(*)::int AS n FROM nex.food_business b
    JOIN nex.food_business_freshness f USING (public_listing_ref)
    WHERE b.public_listing_ref = $1
      AND f.freshness_status = 'FRESH'
  `, [REFS.expired25mo]);
  check("expired record NOT in fresh-only universe", Number(freshOnly.rows[0].n) === 0);

  const anyStatus = await pool.query(`
    SELECT freshness_status FROM nex.food_business_freshness WHERE public_listing_ref = $1
  `, [REFS.expired25mo]);
  check("expired record still queryable (not deleted · historical preserved)", anyStatus.rowCount === 1, `status=${anyStatus.rows[0].freshness_status}`);
}

// ── ASSERTION 7 · successful re-verification restores freshness ──────────
console.log("\n── ASSERTION 7 · successful re-verify restores FRESH ──");
{
  // Simulate Walker re-verify finding evidence today · update last_verified_at
  await pool.query(
    `UPDATE nex.food_business
     SET last_verified_at = now(),
         verification_source = 'walker_reverify'
     WHERE public_listing_ref = $1`,
    [REFS.aging13mo]
  );
  const r = await pool.query(
    `SELECT freshness_status, verification_source FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.aging13mo]
  );
  check("re-verified record now FRESH", r.rows[0].freshness_status === "FRESH", `got ${r.rows[0].freshness_status}`);
  check("verification_source updated to walker_reverify", r.rows[0].verification_source === "walker_reverify");
}

// ── ASSERTION 8 · historical provenance intact after all state changes ───
console.log("\n── ASSERTION 8 · historical provenance intact ──");
{
  const r = await pool.query(
    `SELECT source, source_reference, source_licence_terms, source_ingested_at
     FROM nex.food_business WHERE public_listing_ref = $1`,
    [REFS.aging13mo]
  );
  check("source preserved through freshness updates", r.rows[0].source === "osm_overpass");
  check("source_reference preserved", Boolean(r.rows[0].source_reference));
  check("source_licence_terms preserved", Boolean(r.rows[0].source_licence_terms));
  check("source_ingested_at preserved (not overwritten by re-verify)", Boolean(r.rows[0].source_ingested_at));
}

// ── ASSERTION 9 (bonus) · owner_otp is strongest evidence ────────────────
console.log("\n── ASSERTION 9 · owner_otp beats old OSM element timestamp ──");
{
  // Fixture has source_updated_at=48mo ago BUT verification_source=owner_otp with last_verified_at=now
  // The freshness derives from last_verified_at only · owner_otp wins.
  const r = await pool.query(
    `SELECT freshness_status, verification_source, freshness_days
     FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.ownerVerified]
  );
  check("owner-OTP-verified record is FRESH despite 48mo OSM timestamp", r.rows[0].freshness_status === "FRESH", `status=${r.rows[0].freshness_status} · days=${r.rows[0].freshness_days} · source=${r.rows[0].verification_source}`);
  check("verification_source records owner_otp", r.rows[0].verification_source === "owner_otp");
}

// ── ASSERTION 10 (bonus) · unverified records are UNVERIFIED not defaulted ──
console.log("\n── ASSERTION 10 · unverified records surface honestly ──");
{
  const r = await pool.query(
    `SELECT freshness_status, freshness_days FROM nex.food_business_freshness WHERE public_listing_ref = $1`,
    [REFS.unverified]
  );
  check("no-evidence record is UNVERIFIED (not silently defaulted to FRESH or EXPIRED)", r.rows[0].freshness_status === "UNVERIFIED");
  check("no-evidence record has NULL freshness_days", r.rows[0].freshness_days === null);
}

// ── ASSERTION 11 (bonus) · reverification candidates view surfaces stale ──
console.log("\n── ASSERTION 11 · reverification queue surfaces stale records ──");
{
  const r = await pool.query(
    `SELECT public_listing_ref FROM nex.food_reverification_candidates
     WHERE public_listing_ref IN ($1, $2)`,
    [REFS.expired25mo, REFS.fresh6mo]
  );
  const refs = r.rows.map(x => x.public_listing_ref);
  check("expired 25mo record IS in reverification queue", refs.includes(REFS.expired25mo));
  check("fresh 6mo record is NOT in reverification queue", !refs.includes(REFS.fresh6mo));
}

// ── CLEANUP ──────────────────────────────────────────────────────────────
console.log("\n── CLEANUP · removing test fixtures ──");
for (const ref of Object.values(REFS)) {
  await pool.query(`DELETE FROM nex.food_business WHERE public_listing_ref = $1`, [ref]);
}
console.log(`  cleaned ${Object.keys(REFS).length} fixtures`);

console.log("\n═".repeat(72));
console.log(`RESULT: ${T.pass} passed · ${T.fail} failed`);
if (T.fail > 0) {
  console.log(`Failed: ${T.errors.join(" · ")}`);
  await pool.end();
  process.exit(1);
} else {
  console.log(`WALKER FRESHNESS DOCTRINE · ALL ASSERTIONS PASSED`);
}
console.log("═".repeat(72));

await pool.end();
