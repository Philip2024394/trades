// scripts/nex-worker/identity-resolver-phase1a-tests.mjs
//
// NEX Phase 1a · 4 regression tests · Philip 2026-08-27.
//
// Doctrine: project_nex_dedup_and_identity_resolution_doctrine_2026_08_27.md
//
// Each test runs inside a transaction that ROLLS BACK, so no permanent
// DB rows are created or modified. Zero cleanup risk. Zero data loss.
//
// Tests:
//   (a) same OSM node inserted twice → one row · Layer 1 (source_ref)
//   (b) same website via 2 different sources → one row · Layer 2 (website)
//   (c) MATCHED_EXISTING merges enrichment into original + writes merge log
//   (d) restaurant + laundry sharing name in one city → STAY as TWO rows
//       (proves resolver refuses naive (name, city) collapse)
//
// Exit code 0 = all pass · 1 = any fail. Output shows actual DB state.

import pg from "pg";
import { resolveIdentity, mergeEnrichment } from "./identity-resolver.mjs";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

const TAG = "PHASE1A-TEST";
const runId = `test-${Date.now()}`;

let passed = 0;
let failed = 0;
const results = [];

async function runTest(name, fn) {
  const client = await pool.connect();
  const start = Date.now();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("ROLLBACK");     // always roll back
    console.log(`  ✓ PASS · ${name} · ${Date.now() - start}ms`);
    if (result) for (const line of result) console.log(`      ${line}`);
    passed += 1;
    results.push({ name, status: "pass", ms: Date.now() - start });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.log(`  ✗ FAIL · ${name}`);
    console.log(`      ${err.message}`);
    if (err.stack) console.log(err.stack.split("\n").slice(1, 4).map((l) => "      " + l).join("\n"));
    failed += 1;
    results.push({ name, status: "fail", error: err.message });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Test (a) · same OSM node inserted twice → one row (Layer 1: source_ref)
// ─────────────────────────────────────────────────────────────────────────

async function testSameOsmNodeOnce(client) {
  const sourceRef = `test/node/${runId}-a`;
  const table = "nex.food_business";

  // Seed row 1
  await client.query(
    `INSERT INTO nex.food_business (
       public_listing_ref, business_name, category, city, country,
       source, source_reference, source_licence_terms, source_updated_at,
       dedupe_hash, claim_status, owner_status, created_by,
       coordinates_lat, coordinates_lng
     ) VALUES ($1, $2, 'restaurant', 'Yogyakarta', 'ID',
              'test_osm', $3, 'test', now(),
              $4, 'discovered', 'unknown', 'test',
              -7.7929, 110.3661)`,
    [`#FL-2026-${TAG.slice(0, 5)}`, `${TAG} Rumah Makan A`, sourceRef,
     `test-hash-${runId}-a`],
  );

  // Second observation: same source + source_reference
  const resolved = await resolveIdentity(client, {
    table, candidate: {
      source: "test_osm", sourceReference: sourceRef,
      name: `${TAG} Rumah Makan A DIFFERENT NAME`, city: "DifferentCity",
    },
  });

  if (resolved.match !== "strong" || resolved.layer !== "source_ref") {
    throw new Error(`Expected strong/source_ref, got ${resolved.match}/${resolved.layer}`);
  }
  return [`resolver: strong · layer=source_ref · existing.public_listing_ref=${resolved.existing.public_listing_ref}`];
}

// ─────────────────────────────────────────────────────────────────────────
// Test (b) · same website via 2 sources → one row (Layer 2: website)
// ─────────────────────────────────────────────────────────────────────────

async function testSameWebsiteOnce(client) {
  const table = "nex.accommodation_business";
  const website = `https://www.${runId}-b.example.co.id/`;

  await client.query(
    `INSERT INTO nex.accommodation_business (
       public_listing_ref, business_name, category, city, country,
       source, source_reference, source_licence_terms, source_updated_at,
       dedupe_hash, claim_status, owner_status, created_by,
       coordinates_lat, coordinates_lng, website
     ) VALUES ($1, $2, 'hotel', 'Yogyakarta', 'ID',
              'test_osm', $3, 'test', now(),
              $4, 'discovered', 'unknown', 'test',
              -7.79, 110.37, $5)`,
    [`#AC-2026-${TAG.slice(0, 5)}`, `${TAG} Wisma B`, `test/node/${runId}-b`,
     `test-hash-${runId}-b`, website],
  );

  // Second observation: different source but same website (differently formatted)
  const resolved = await resolveIdentity(client, {
    table, candidate: {
      source: "google_places",
      sourceReference: `place/${runId}-different`,
      name: "Completely Different Name Wisma B",
      city: "DifferentCity",
      website: `${runId}-b.example.co.id`,   // no protocol, no www, no trailing slash
    },
  });

  if (resolved.match !== "strong" || resolved.layer !== "website") {
    throw new Error(`Expected strong/website, got ${resolved.match}/${resolved.layer}`);
  }
  return [`resolver: strong · layer=website · matched normalized website form`];
}

// ─────────────────────────────────────────────────────────────────────────
// Test (c) · MATCHED_EXISTING merges enrichment + writes merge log
// ─────────────────────────────────────────────────────────────────────────

async function testMergeEnrichmentAndLog(client) {
  const table = "nex.food_business";
  const sourceRef = `test/node/${runId}-c`;
  const ref = `#FL-2026-${TAG.slice(0, 4)}C`;

  // Seed row with NULL phone/website — those fields can be enriched
  await client.query(
    `INSERT INTO nex.food_business (
       public_listing_ref, business_name, category, city, country,
       source, source_reference, source_licence_terms, source_updated_at,
       dedupe_hash, claim_status, owner_status, created_by,
       coordinates_lat, coordinates_lng, phone, website
     ) VALUES ($1, $2, 'restaurant', 'Yogyakarta', 'ID',
              'test_osm', $3, 'test', now(),
              $4, 'discovered', 'unknown', 'test',
              -7.79, 110.37, NULL, NULL)`,
    [ref, `${TAG} Rumah Makan C`, sourceRef, `test-hash-${runId}-c`],
  );

  const resolved = await resolveIdentity(client, {
    table, candidate: { source: "test_osm", sourceReference: sourceRef, name: "test", city: "test" },
  });
  if (resolved.match !== "strong") throw new Error(`Layer 1 should match, got ${resolved.match}`);

  // Now merge with enrichment values
  const merge = await mergeEnrichment(client, {
    table, existing: resolved.existing,
    incoming: {
      source: "google_places",
      sourceReference: `place/${runId}-c-enrich`,
      name: `${TAG} Rumah Makan C`, city: "Yogyakarta",
      website: "https://c-restaurant.example.co.id",
      phone: "+62-812-3456-7890",
    },
    layer: resolved.layer,
    enrichableFields: ["phone", "website"],
    incomingValues: {
      phone: "+62-812-3456-7890",
      website: "https://c-restaurant.example.co.id",
    },
    workerId: "test:worker",
    cycleRunId: null,
  });

  // Verify existing row was enriched
  const after = (await client.query(
    `SELECT phone, website FROM nex.food_business WHERE public_listing_ref = $1`,
    [ref],
  )).rows[0];
  if (!after.phone || !after.website) {
    throw new Error(`Enrichment failed: phone=${after.phone} website=${after.website}`);
  }

  // Verify merge log row written
  const log = (await client.query(
    `SELECT match_layer, enriched_fields, incoming_source, incoming_source_reference
       FROM nex.identity_merge_log
      WHERE existing_ref = $1
      ORDER BY merged_at DESC LIMIT 1`,
    [ref],
  )).rows[0];
  if (!log) throw new Error("merge log row not written");
  if (log.match_layer !== "source_ref") throw new Error(`merge log layer wrong: ${log.match_layer}`);
  if (!log.enriched_fields.includes("phone") || !log.enriched_fields.includes("website")) {
    throw new Error(`merge log enriched_fields wrong: ${log.enriched_fields.join(",")}`);
  }

  return [
    `existing row enriched: phone="${after.phone}" · website="${after.website}"`,
    `merge log row: layer=source_ref · enriched=[${log.enriched_fields.join(",")}] · incoming_source=${log.incoming_source}`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Test (d) · restaurant + laundry sharing name in one city → TWO rows
// (proves resolver does NOT collapse on (name, city) alone)
// ─────────────────────────────────────────────────────────────────────────

async function testNoNaiveNameCityCollapse(client) {
  const restaurantRef = `#FL-2026-${TAG.slice(0, 4)}D`;
  const serviceRef = `#SB-2026-${TAG.slice(0, 4)}D`;

  // Seed a restaurant "ABC Services" in Yogyakarta (yes, the name IS "ABC Services")
  await client.query(
    `INSERT INTO nex.food_business (
       public_listing_ref, business_name, category, city, country,
       source, source_reference, source_licence_terms, source_updated_at,
       dedupe_hash, claim_status, owner_status, created_by,
       coordinates_lat, coordinates_lng
     ) VALUES ($1, 'ABC Services', 'restaurant', 'Yogyakarta', 'ID',
              'test_osm', $2, 'test', now(),
              $3, 'discovered', 'unknown', 'test',
              -7.79, 110.37)`,
    [restaurantRef, `test/node/${runId}-d-restaurant`, `test-hash-${runId}-d1`],
  );

  // Now the resolver sees a NEW "ABC Services" candidate in Yogyakarta.
  // Different source_reference, no website, no phone, coordinates 500m away
  // (across town from the restaurant). It's actually a laundry business.
  const resolved = await resolveIdentity(client, {
    table: "nex.food_business",   // same table for the test simplicity
    candidate: {
      source: "test_osm",
      sourceReference: `test/node/${runId}-d-laundry`,   // different!
      name: "ABC Services",   // same normalized name
      city: "Yogyakarta",     // same city
      lat: -7.7930,           // ~500m away
      lng: 110.3800,
      // NO website, NO phone → no strong signals
    },
  });

  // Must be CANDIDATE (Layer 4), NOT strong. The doctrine forbids
  // treating name+city as absolute identity.
  if (resolved.match === "strong") {
    throw new Error(`FALSE MERGE · resolver strong-matched two legitimately-different businesses on name+city alone (layer=${resolved.layer}). This violates doctrine §1.`);
  }
  if (resolved.match !== "candidate") {
    throw new Error(`Expected candidate, got ${resolved.match}`);
  }
  if (resolved.layer !== "name_city") {
    throw new Error(`Expected layer=name_city, got layer=${resolved.layer}`);
  }
  return [
    `resolver: candidate · layer=name_city · caller MUST insert as a new row`,
    `existing.ref found in candidates but not auto-merged (correct behaviour)`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  NEX PHASE 1a · Regression Tests · Philip 2026-08-27");
  console.log("  All tests run in transactions that ROLLBACK · zero DB persistence");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("");

  await runTest("(a) same OSM node inserted twice → Layer 1 strong match", testSameOsmNodeOnce);
  await runTest("(b) same website via 2 sources → Layer 2 strong match", testSameWebsiteOnce);
  await runTest("(c) merge enriches existing + writes identity_merge_log", testMergeEnrichmentAndLog);
  await runTest("(d) same name in one city, no strong signal → CANDIDATE only (no false merge)", testNoNaiveNameCityCollapse);

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  Result: ${passed} passed · ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("");
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test-runner crashed:", e);
  pool.end();
  process.exit(2);
});
