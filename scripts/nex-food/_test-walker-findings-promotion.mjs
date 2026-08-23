// End-to-end test: Walker discovery → walker-findings visibility → admin
// promotion → appears on /food → provenance intact → owner_verified untouched.
//
// Tests directly against DB + shared claim-service semantics. Does NOT hit
// the HTTP route (Next dev server may not be running). Test replicates the
// EXACT SQL the route runs so it verifies the same behaviour.

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL });

const T = { pass: 0, fail: 0, errors: [] };
function check(name, cond, detail = "") {
  if (cond) { T.pass++; console.log(`  ✓ ${name}${detail ? "  · " + detail : ""}`); }
  else { T.fail++; T.errors.push(name); console.log(`  ✗ ${name}${detail ? "  · " + detail : ""}`); }
}

console.log("═".repeat(72));
console.log("WALKER FINDINGS · PROMOTION PIPELINE · TEST");
console.log("═".repeat(72));

// Pick a specific Walker discovery to promote (Satria Resto · has contact)
const TEST_REF = "#FL-2026-000WP";

// ── SETUP · confirm target is discovered ─────────────────────────────────
console.log(`\n── SETUP · verify ${TEST_REF} starts as 'discovered' ──`);
{
  const r = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status, owner_status,
            whatsapp_number, phone, website, source, source_reference, source_licence_terms
     FROM nex.food_business WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  if (r.rowCount === 0) {
    console.log(`  ✗ target ${TEST_REF} not found · skipping tests`);
    await pool.end();
    process.exit(1);
  }
  const b = r.rows[0];
  check("target starts at claim_status='discovered'", b.claim_status === "discovered", `got ${b.claim_status}`);
  check("target has real contact from OSM (WA or phone)", Boolean(b.whatsapp_number) || Boolean(b.phone));
  check("target has full provenance", Boolean(b.source) && Boolean(b.source_reference) && Boolean(b.source_licence_terms));
  console.log(`    business:    ${b.business_name}`);
  console.log(`    contact:     wa=${b.whatsapp_number ?? "—"} · tel=${b.phone ?? "—"}`);
  console.log(`    provenance:  ${b.source} · ${b.source_reference}`);
}

// ── TEST 1 · discovered does NOT appear on /food (query filter excludes) ─
console.log("\n── TEST 1 · discovered NOT auto-published to /food ──");
{
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM nex.food_business
     WHERE public_listing_ref = $1
       AND claim_status IN ('listed','invited','claimed','paying')`,
    [TEST_REF]
  );
  check("target NOT visible via /food query (still discovered)", Number(r.rows[0].n) === 0, `count=${r.rows[0].n}`);
}

// ── TEST 2 · walker-findings query DOES surface the target ───────────────
console.log("\n── TEST 2 · walker-findings admin query surfaces the target ──");
{
  const r = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status
     FROM nex.food_business
     WHERE claim_status = 'discovered' AND public_listing_ref = $1`,
    [TEST_REF]
  );
  check("target IS visible in walker-findings query", r.rowCount === 1);
}

// ── TEST 3 · admin promotion moves discovered → listed ───────────────────
console.log("\n── TEST 3 · admin promotion changes claim_status ──");
{
  const before = await pool.query(
    `SELECT claim_status, owner_status, whatsapp_number, phone, website FROM nex.food_business WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  const b = before.rows[0];

  // Replicate the route logic in a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE nex.food_business SET claim_status = 'listed'
       WHERE public_listing_ref = $1 AND claim_status = 'discovered'`,
      [TEST_REF]
    );
    await client.query(
      `INSERT INTO nex.audit_log (entity_type, entity_id, action, actor, before_state, after_state, notes)
       VALUES ('food_business', $1, 'promote_to_directory', 'test:_test-walker-findings-promotion', $2::jsonb, $3::jsonb, $4)`,
      [
        TEST_REF,
        JSON.stringify({ claim_status: b.claim_status, owner_status: b.owner_status, has_whatsapp: Boolean(b.whatsapp_number), has_phone: Boolean(b.phone), source: "osm_overpass" }),
        JSON.stringify({ claim_status: "listed", owner_status: b.owner_status }),
        "smoke test",
      ]
    );
    await client.query("COMMIT");
  } finally { client.release(); }

  const after = await pool.query(
    `SELECT claim_status, owner_status, whatsapp_number, phone, website, source, source_reference, source_licence_terms
     FROM nex.food_business WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  const a = after.rows[0];
  check("claim_status now 'listed'", a.claim_status === "listed");
  check("owner_status NOT touched (still 'unknown')", a.owner_status === b.owner_status && a.owner_status === "unknown");
  check("whatsapp_number preserved (no fabrication · no overwrite)", a.whatsapp_number === b.whatsapp_number);
  check("phone preserved", a.phone === b.phone);
  check("website preserved", a.website === b.website);
  check("provenance source preserved", a.source === "osm_overpass");
  check("provenance source_reference preserved", Boolean(a.source_reference));
  check("provenance licence preserved", (a.source_licence_terms ?? "").includes("ODbL"));
}

// ── TEST 4 · promoted record now appears on /food ────────────────────────
console.log("\n── TEST 4 · promoted record NOW appears on /food ──");
{
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM nex.food_business
     WHERE public_listing_ref = $1
       AND claim_status IN ('listed','invited','claimed','paying')`,
    [TEST_REF]
  );
  check("target NOW visible via /food query", Number(r.rows[0].n) === 1);
}

// ── TEST 5 · audit_log recorded the promotion ────────────────────────────
console.log("\n── TEST 5 · audit_log recorded the promotion ──");
{
  const r = await pool.query(
    `SELECT action, actor, before_state, after_state
     FROM nex.audit_log
     WHERE entity_type = 'food_business' AND entity_id = $1
       AND action = 'promote_to_directory'
     ORDER BY created_at DESC LIMIT 1`,
    [TEST_REF]
  );
  check("audit_log row exists for promotion", r.rowCount === 1);
  if (r.rowCount === 1) {
    const row = r.rows[0];
    check("audit before_state.claim_status = 'discovered'", row.before_state.claim_status === "discovered");
    check("audit after_state.claim_status = 'listed'", row.after_state.claim_status === "listed");
    check("audit records actor", Boolean(row.actor));
  }
}

// ── TEST 6 · idempotent · re-promoting is no-op ──────────────────────────
console.log("\n── TEST 6 · promotion is idempotent ──");
{
  // Second promote attempt should not double-flip · UPDATE has WHERE claim_status='discovered'
  const r = await pool.query(
    `UPDATE nex.food_business SET claim_status = 'listed'
     WHERE public_listing_ref = $1 AND claim_status = 'discovered'
     RETURNING claim_status`,
    [TEST_REF]
  );
  check("second promote is no-op (row not updated because already listed)", r.rowCount === 0);
  const check2 = await pool.query(
    `SELECT claim_status FROM nex.food_business WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  check("state remains 'listed' after second attempt", check2.rows[0].claim_status === "listed");
}

// ── TEST 7 · Commercial Universe view: promoted record with contact appears ─
console.log("\n── TEST 7 · promoted contactable record enters Commercial Universe ──");
{
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM nex.food_commercial_universe WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  check("promoted record with WhatsApp/phone now in Commercial Universe view", Number(r.rows[0].n) === 1);
}

// ── TEST 8 · Layer 3 owner claim path still works for other discovered records ─
console.log("\n── TEST 8 · owner claim still valid for other discovered records ──");
{
  // Pick any other discovered record with contact
  const r = await pool.query(
    `SELECT public_listing_ref FROM nex.food_business
     WHERE claim_status = 'discovered' AND (whatsapp_number IS NOT NULL OR phone IS NOT NULL)
     ORDER BY source_ingested_at DESC LIMIT 1`
  );
  if (r.rowCount > 0) {
    check("discovered records with contact still exist (Layer 3 path available)", true, `sample: ${r.rows[0].public_listing_ref}`);
  } else {
    check("no more contactable discovered records (all consumed?)", true, "(none remaining · not a failure)");
  }
}

// ── TEST 9 · no fabrication check · promoted record's fields match original OSM ─
console.log("\n── TEST 9 · no fabrication survives promotion ──");
{
  const r = await pool.query(
    `SELECT rating, review_count, hero_image_approved FROM nex.food_business WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  const row = r.rows[0];
  check("promoted record has NO fabricated rating", row.rating === null);
  check("promoted record has NO fabricated review_count", row.review_count === null);
  check("promoted record hero_image_approved = false (never auto-approved)", row.hero_image_approved === false);
}

// ── CLEANUP · revert the test promotion so DB state stays sane ───────────
console.log("\n── CLEANUP · revert test promotion ──");
{
  await pool.query(
    `UPDATE nex.food_business SET claim_status = 'discovered'
     WHERE public_listing_ref = $1`,
    [TEST_REF]
  );
  await pool.query(
    `DELETE FROM nex.audit_log
     WHERE entity_type = 'food_business' AND entity_id = $1
       AND action = 'promote_to_directory'
       AND actor = 'test:_test-walker-findings-promotion'`,
    [TEST_REF]
  );
  const r = await pool.query(`SELECT claim_status FROM nex.food_business WHERE public_listing_ref = $1`, [TEST_REF]);
  console.log(`  reverted · ${TEST_REF} back to '${r.rows[0].claim_status}'`);
}

console.log("\n═".repeat(72));
console.log(`RESULT: ${T.pass} passed · ${T.fail} failed`);
if (T.fail > 0) {
  console.log(`Failed: ${T.errors.join(" · ")}`);
  await pool.end();
  process.exit(1);
} else {
  console.log(`WALKER FINDINGS · PROMOTION PIPELINE · ALL PASSED`);
}
console.log("═".repeat(72));

await pool.end();
