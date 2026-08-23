#!/usr/bin/env node
// NEX Food · dedupe scanner · Phase 3.
//
// Scans nex.food_business, groups likely-duplicate pairs, and produces a
// human-readable candidates report. No auto-merge · admin reviews the report
// and decides. Merge tooling lands as Phase 3.5 when we actually hit an
// admin-confirmed duplicate.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/dedupe-scan.mjs
//     [--min-confidence=0.70]
//     [--test-tempo-gelato]           inject 3 synthetic Tempo Gelato variants
//                                      and verify scanner catches them
//     [--json]                         emit JSON instead of the text report

import pg from "pg";

// Inline copy of the pure functions from src/lib/nex-food/dedupe.ts.
// (mjs · avoids the TS build step for a script)

const BUSINESS_SUFFIX_STOP = [
  "jogja","yogyakarta","yogya","prawirotaman","malioboro","kotabaru","sleman",
  "bantul","kotagede","restoran","restaurant","resto","cafe","coffee","kopi",
  "warung","kedai",
];

function normaliseBusinessName(name) {
  let n = name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = n.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !BUSINESS_SUFFIX_STOP.includes(t));
  return kept.length > 0 ? kept.join(" ") : n;
}

function normalisePhoneTail(phone, take = 6) {
  if (!phone) return "";
  return phone.replace(/\D+/g, "").slice(-take);
}

function tokenJaccard(a, b) {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function haversineMetres(aLat, aLng, bLat, bLng) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function scorePair(a, b) {
  const exactHash = a.dedupeHash === b.dedupeHash;
  const nameNormA = normaliseBusinessName(a.businessName);
  const nameNormB = normaliseBusinessName(b.businessName);
  const nameJaccard = tokenJaccard(nameNormA, nameNormB);
  const coordDistanceMetres = haversineMetres(
    a.coordinatesLat, a.coordinatesLng, b.coordinatesLat, b.coordinatesLng
  );
  const phoneTailMatch = normalisePhoneTail(a.phone) !== "" &&
    normalisePhoneTail(a.phone) === normalisePhoneTail(b.phone);
  const categoryMatch = a.category === b.category;

  let score = 0;
  const reasons = [];
  if (exactHash) { score = 1.0; reasons.push("exact dedupe_hash match"); }
  else {
    if (nameJaccard >= 0.9) { score += 0.55; reasons.push(`name jaccard ${nameJaccard.toFixed(2)}`); }
    else if (nameJaccard >= 0.6) { score += 0.35; reasons.push(`name jaccard ${nameJaccard.toFixed(2)}`); }
    else if (nameJaccard >= 0.4) { score += 0.15; reasons.push(`name jaccard ${nameJaccard.toFixed(2)}`); }
    if (coordDistanceMetres != null) {
      if (coordDistanceMetres <= 30) { score += 0.30; reasons.push(`coord ${Math.round(coordDistanceMetres)}m`); }
      else if (coordDistanceMetres <= 100) { score += 0.20; reasons.push(`coord ${Math.round(coordDistanceMetres)}m`); }
      else if (coordDistanceMetres <= 300) { score += 0.05; reasons.push(`coord ${Math.round(coordDistanceMetres)}m`); }
    }
    if (phoneTailMatch) { score += 0.25; reasons.push("phone tail-6 match"); }
    if (!categoryMatch) { score -= 0.20; reasons.push("category mismatch (penalty)"); }
  }
  const confidence = Math.max(0, Math.min(1, score));
  return {
    refA: a.publicListingRef,
    refB: b.publicListingRef,
    nameA: a.businessName,
    nameB: b.businessName,
    confidence: Number(confidence.toFixed(3)),
    signals: {
      exactHash,
      nameJaccard: Number(nameJaccard.toFixed(3)),
      coordDistanceMetres: coordDistanceMetres != null ? Math.round(coordDistanceMetres) : null,
      phoneTailMatch, categoryMatch,
    },
    reason: reasons.join(" · ") || "no signals",
  };
}

function findDuplicateCandidates(rows, minConfidence) {
  const pairs = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const p = scorePair(rows[i], rows[j]);
      if (p.confidence >= minConfidence) pairs.push(p);
    }
  }
  return pairs.sort((a, b) => b.confidence - a.confidence);
}

// ── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const minConfArg = args.find((a) => a.startsWith("--min-confidence="));
const minConfidence = minConfArg ? Number(minConfArg.split("=")[1]) : 0.70;
const wantTest = args.includes("--test-tempo-gelato");
const wantJson = args.includes("--json");

// Synthetic test fixture. Three "same business" variants — must all score
// as high-confidence pairs of each other.
const TEMPO_GELATO_TEST_ROWS = [
  {
    publicListingRef: "#FL-TEST-TG001",
    businessName: "Tempo Gelato",
    category: "ice-cream-dessert",
    phone: "+62 274 550808",
    coordinatesLat: -7.8185, coordinatesLng: 110.3647,
    dedupeHash: "tempo gelato||550808|-7.819|110.365",
  },
  {
    publicListingRef: "#FL-TEST-TG002",
    businessName: "Tempo Gelato Jogja",
    category: "ice-cream-dessert",
    phone: "0274-550808",
    coordinatesLat: -7.8186, coordinatesLng: 110.3648,
    dedupeHash: "tempo gelato jogja||550808|-7.819|110.365",
  },
  {
    publicListingRef: "#FL-TEST-TG003",
    businessName: "Tempo Gelato Prawirotaman",
    category: "ice-cream-dessert",
    phone: null,
    coordinatesLat: -7.8188, coordinatesLng: 110.3649,
    dedupeHash: "tempo gelato prawirotaman|prawirotaman||-7.819|110.365",
  },
  // Negative control · a real different business.
  {
    publicListingRef: "#FL-TEST-NG001",
    businessName: "Aurora Gelato",
    category: "ice-cream-dessert",
    phone: null,
    coordinatesLat: -7.7745, coordinatesLng: 110.4097,
    dedupeHash: "aurora gelato|||-7.774|110.410",
  },
];

function reportText(pairs, meta) {
  console.log("── NEX Food · Dedupe Scan ──");
  console.log(`  source                : ${meta.source}`);
  console.log(`  rows scanned          : ${meta.rowCount}`);
  console.log(`  candidate pairs       : ${pairs.length}`);
  console.log(`  min confidence        : ${minConfidence}`);
  console.log("");
  if (pairs.length === 0) {
    console.log("  (no candidate pairs at or above the confidence threshold · clean data)");
    return;
  }
  const autoBand = pairs.filter((p) => p.confidence >= 0.90);
  const reviewBand = pairs.filter((p) => p.confidence >= 0.70 && p.confidence < 0.90);
  console.log(`  BAND · auto-mergeable (≥0.90)   : ${autoBand.length}`);
  console.log(`  BAND · admin-review  (0.70-0.90): ${reviewBand.length}`);
  console.log("");
  console.log("── Candidate pairs (highest confidence first) ──");
  for (const p of pairs) {
    const band = p.confidence >= 0.90 ? "AUTO " : "REVIEW";
    console.log(`  [${band}] conf=${p.confidence.toFixed(2)}  ${p.refA} ↔ ${p.refB}`);
    console.log(`         A: ${p.nameA}`);
    console.log(`         B: ${p.nameB}`);
    console.log(`         signals: ${p.reason}`);
  }
}

async function loadRowsFromDb() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  const pool = new pg.Pool({ connectionString: url });
  const q = await pool.query(`
    SELECT
      public_listing_ref, business_name, category, phone,
      coordinates_lat, coordinates_lng, dedupe_hash
    FROM nex.food_business
    ORDER BY created_at
  `);
  await pool.end();
  return q.rows.map((r) => ({
    publicListingRef: r.public_listing_ref,
    businessName: r.business_name,
    category: r.category,
    phone: r.phone,
    coordinatesLat: r.coordinates_lat != null ? Number(r.coordinates_lat) : null,
    coordinatesLng: r.coordinates_lng != null ? Number(r.coordinates_lng) : null,
    dedupeHash: r.dedupe_hash,
  }));
}

async function main() {
  let rows;
  let sourceLabel;
  if (wantTest) {
    const live = await loadRowsFromDb();
    rows = [...live, ...TEMPO_GELATO_TEST_ROWS];
    sourceLabel = `nex.food_business (${live.length} rows) + Tempo Gelato test fixture (${TEMPO_GELATO_TEST_ROWS.length} rows)`;
  } else {
    rows = await loadRowsFromDb();
    sourceLabel = "nex.food_business (live)";
  }

  const pairs = findDuplicateCandidates(rows, minConfidence);

  if (wantJson) {
    console.log(JSON.stringify({
      source: sourceLabel,
      rowCount: rows.length,
      minConfidence,
      pairs,
    }, null, 2));
    return;
  }

  reportText(pairs, { source: sourceLabel, rowCount: rows.length });

  // If --test-tempo-gelato was passed, enforce the assertion.
  if (wantTest) {
    const tempoRefs = new Set(TEMPO_GELATO_TEST_ROWS.slice(0, 3).map((r) => r.publicListingRef));
    const tempoPairs = pairs.filter((p) => tempoRefs.has(p.refA) && tempoRefs.has(p.refB));
    const expected = 3;   // C(3,2) = 3 pairs among the 3 Tempo Gelato variants
    console.log("");
    console.log("── Tempo Gelato test assertion ──");
    console.log(`  expected pairs (3 variants → C(3,2)) : ${expected}`);
    console.log(`  scanner found                        : ${tempoPairs.length}`);
    // Also verify Aurora Gelato is NOT flagged as a duplicate of Tempo Gelato.
    const auroraCrossPairs = pairs.filter((p) => {
      const refs = [p.refA, p.refB];
      return refs.some((r) => r === "#FL-TEST-NG001") &&
             refs.some((r) => tempoRefs.has(r));
    });
    console.log(`  Aurora × Tempo false-positives       : ${auroraCrossPairs.length} (want 0)`);
    if (tempoPairs.length === expected && auroraCrossPairs.length === 0) {
      console.log("  RESULT: PASS");
      process.exit(0);
    } else {
      console.log("  RESULT: FAIL");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
