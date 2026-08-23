#!/usr/bin/env node
// NEX Food · Enrichment agent 'google_places' · Phase 8.1.2.
//
// Google Places API (New) enrichment · ToS-compliant.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
//       https://developers.google.com/maps/documentation/places/web-service/place-details
//
// Legal:
//   - Requires GOOGLE_PLACES_API_KEY in .env.local + billing enabled on the
//     Google Cloud project
//   - Data must display "Powered by Google" attribution wherever surfaced
//     (footer of /food already wired to render `attribution` string · we
//     append "Powered by Google" when any google_places evidence appears)
//   - Data may be cached up to 30 days per Google ToS · we cache raw JSON
//     responses in .cache/google-places/ with mtime-based expiry
//   - Never overwrites owner_verified or admin_verified fields · same guard
//     as every other enrichment agent
//
// Cost:
//   - Text Search:     $32 / 1000 requests
//   - Place Details:   $17 / 1000 requests (Contact-tier FieldMask)
//   - Estimate for 806 businesses: ~$40 USD one-time
//   - Field-masked to minimise cost (we only ask for what we need)
//
// USAGE
//   NEX_POSTGRES_URL=... GOOGLE_PLACES_API_KEY=... \
//     node scripts/nex-food/enrich-from-google-places.mjs
//     [--dry-run]  [--limit=N]  [--budget=N]   safety cap on request count

import pg from "pg";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache", "google-places");
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days per Google ToS

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const budgetArg = args.find((a) => a.startsWith("--budget="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : null;
const budget = budgetArg ? Number(budgetArg) : 2000;   // absolute cap on API calls per run

const pgUrl = process.env.NEX_POSTGRES_URL;
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!pgUrl) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
if (!apiKey && !dryRun) {
  console.error("GOOGLE_PLACES_API_KEY not set");
  console.error("");
  console.error("Setup:");
  console.error("  1. Google Cloud Console → create project or use existing");
  console.error("  2. APIs & Services → Library → 'Places API (New)' → Enable");
  console.error("  3. Billing → link/create billing account (Google requires this");
  console.error("     even for the $200/mo free tier)");
  console.error("  4. APIs & Services → Credentials → Create Credentials → API key");
  console.error("  5. Restrict the key to Places API only (recommended)");
  console.error("  6. Add to .env.local:");
  console.error("       GOOGLE_PLACES_API_KEY=AIza...");
  console.error("  7. Re-run this script");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: pgUrl });

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// ── Cost & rate tracking ────────────────────────────────────────────────────

let textSearchCalls = 0;
let placeDetailsCalls = 0;
let cachedHits = 0;
const startTime = Date.now();

function estimatedCostUsd() {
  return (textSearchCalls * 0.032) + (placeDetailsCalls * 0.017);
}

async function ensureBudget() {
  const totalCalls = textSearchCalls + placeDetailsCalls;
  if (totalCalls >= budget) {
    console.error(`\n⚠ BUDGET REACHED · ${totalCalls} API calls · $${estimatedCostUsd().toFixed(2)} estimated`);
    console.error("Exiting to avoid runaway cost. Increase with --budget=N if intentional.");
    await pool.end();
    process.exit(0);
  }
}

// Google's free-tier QPS is 10 req/sec · we stay under that
let lastCallAt = 0;
async function rateLimit() {
  const now = Date.now();
  const wait = 120 - (now - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// ── Cache ───────────────────────────────────────────────────────────────────

function cacheKey(kind, query) {
  return createHash("sha1").update(`${kind}::${query}`).digest("hex").slice(0, 16);
}
function readCache(kind, query) {
  const p = join(CACHE_DIR, `${kind}-${cacheKey(kind, query)}.json`);
  if (!existsSync(p)) return null;
  const age = Date.now() - statSync(p).mtimeMs;
  if (age > CACHE_TTL_MS) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch { return null; }
}
function writeCache(kind, query, data) {
  const p = join(CACHE_DIR, `${kind}-${cacheKey(kind, query)}.json`);
  writeFileSync(p, JSON.stringify(data), "utf8");
}

// ── Google Places API helpers ───────────────────────────────────────────────

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

async function textSearch(query) {
  const cached = readCache("text", query);
  if (cached) { cachedHits++; return cached; }

  if (dryRun) {
    // TRUE dry-run · zero API calls · zero cost. Return synthetic empty
    // response so downstream code proceeds with 'no match'. The report will
    // show the workload without actually spending anything.
    return { places: [] };
  }

  await ensureBudget();
  await rateLimit();
  textSearchCalls++;

  const resp = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType",
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        // Yogyakarta city bias
        circle: { center: { latitude: -7.8014, longitude: 110.3644 }, radius: 8000 },
      },
      pageSize: 5,
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`textSearch ${resp.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await resp.json();
  writeCache("text", query, data);
  return data;
}

async function placeDetails(placeId) {
  const cached = readCache("details", placeId);
  if (cached) { cachedHits++; return cached; }

  if (dryRun) {
    // TRUE dry-run · zero API calls · zero cost.
    return null;
  }

  await ensureBudget();
  await rateLimit();
  placeDetailsCalls++;

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      // Contact-tier FieldMask · lowest cost that still yields phone + hours + website
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,nationalPhoneNumber,internationalPhoneNumber,websiteUri,regularOpeningHours,rating,userRatingCount,primaryTypeDisplayName,types",
    },
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`placeDetails ${resp.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await resp.json();
  writeCache("details", placeId, data);
  return data;
}

// ── Identity match ─────────────────────────────────────────────────────────

// Indonesian food-category words that are commonly USED as business names
// (Philip 2026-08-21: "Angkringan" is the flagged example). If the NEX
// business name is one of these OR is just a generic term + one qualifier,
// require stronger location agreement before accepting the match.
const GENERIC_INDONESIAN_FOOD_NAMES = new Set([
  "angkringan","warung","warteg","rumah","makan","rm","kedai","depot",
  "ayam","nasi","mie","bakso","sate","bebek","ikan","seafood",
  "kopi","kafe","cafe","gerobak","tenda","lesehan","gudeg","soto",
  "padang","jawa","chinese","japanese",
  // Bare category words (would match too many places)
  "restaurant","food","juice","drink",
]);

function isGenericName(businessName) {
  const tokens = String(businessName ?? "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.length <= 2 && tokens.every((t) => GENERIC_INDONESIAN_FOOD_NAMES.has(t))) return true;
  // Also generic: single token that IS a generic word
  if (tokens.length === 1 && GENERIC_INDONESIAN_FOOD_NAMES.has(tokens[0])) return true;
  return false;
}

// Coord distance in metres (Haversine · shared with dedupe layer conceptually)
function coordDistMetres(aLat, aLng, bLat, bLng) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Compare NEX business to Google Place candidate · returns { confidence, tier, reasoning }
// Tier gates (Philip 2026-08-21):
//   HIGH   → eligible for promotion (auto-apply · respecting owner_verified guard)
//   MEDIUM → evidence only · flag for HQ review
//   LOW    → reject · no evidence written
// Generic names require STRONGER location agreement (100m HIGH · 300m MEDIUM).
function identityMatch(nex, googlePlace) {
  const nexName = String(nex.business_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const gName = String(googlePlace.displayName?.text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nexTokens = new Set(nexName.split(/\s+/).filter(Boolean));
  const gTokens = new Set(gName.split(/\s+/).filter(Boolean));
  let overlap = 0;
  for (const t of nexTokens) if (gTokens.has(t)) overlap++;
  const nameJaccard = overlap / Math.max(nexTokens.size, gTokens.size, 1);
  const distMetres = coordDistMetres(
    nex.coordinates_lat, nex.coordinates_lng,
    googlePlace.location?.latitude, googlePlace.location?.longitude
  );
  const generic = isGenericName(nex.business_name);

  // Score composite
  let coordScore = 0;
  if (distMetres != null) {
    if (distMetres < 100) coordScore = 1;
    else if (distMetres < 300) coordScore = 0.7;
    else if (distMetres < 500) coordScore = 0.4;
    else if (distMetres < 1000) coordScore = 0.15;
    else coordScore = 0;
  }
  const composite = Math.min(1, nameJaccard * 0.65 + coordScore * 0.35);

  // Tier classification · Philip 2026-08-21 gates
  let tier;
  const reasoning = [];
  reasoning.push(`name-jaccard=${nameJaccard.toFixed(2)}`);
  if (distMetres != null) reasoning.push(`coord=${Math.round(distMetres)}m`);
  else reasoning.push(`coord=missing`);
  if (generic) reasoning.push(`generic-name`);

  if (generic) {
    // Generic names require STRONGER location agreement
    if (nameJaccard >= 0.7 && distMetres != null && distMetres < 100) tier = "HIGH";
    else if (nameJaccard >= 0.5 && distMetres != null && distMetres < 300) tier = "MEDIUM";
    else tier = "LOW";
  } else {
    // Non-generic name · standard thresholds
    if (nameJaccard >= 0.7 && distMetres != null && distMetres < 300) tier = "HIGH";
    else if (nameJaccard >= 0.9 && distMetres == null) tier = "MEDIUM";   // name-only match · uncertain
    else if (nameJaccard >= 0.5 && distMetres != null && distMetres < 500) tier = "MEDIUM";
    else if (nameJaccard >= 0.3 && distMetres != null && distMetres < 200) tier = "MEDIUM";
    else tier = "LOW";
  }

  return { confidence: composite, tier, reasoning: reasoning.join(" · "), nameJaccard, distMetres, generic };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("── google_places enrichment ──");
  console.log(`  mode                   : ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`  budget cap             : ${budget} API calls`);
  console.log(`  Google Cloud API key   : ${apiKey ? apiKey.slice(0, 8) + "..." + apiKey.slice(-4) : "(not set · dry-run only)"}`);
  console.log(`  Cost estimate for full : ~$40 (806 businesses)`);
  console.log("");

  // Load businesses we'd potentially enrich · prefer no-contact ones first
  const rows = (await pool.query(`
    SELECT public_listing_ref, business_name, category, district,
           coordinates_lat, coordinates_lng, whatsapp_number, phone, website
    FROM nex.food_business
    WHERE city = 'Yogyakarta'
      AND claim_status IN ('listed','invited','claimed','paying')
    ORDER BY
      (whatsapp_number IS NULL OR whatsapp_number = '')::int DESC,   -- no-contact first
      (phone IS NULL OR phone = '')::int DESC,
      business_name
  `)).rows;

  const workload = limit ? rows.slice(0, limit) : rows;
  console.log(`  businesses in workload : ${workload.length}`);
  console.log(`  (no-contact prioritised first)`);
  console.log("");

  const provenance = new Map();
  (await pool.query(`SELECT business_ref, field_name, trust_layer FROM nex.food_business_field_provenance`))
    .rows.forEach((r) => provenance.set(`${r.business_ref}|${r.field_name}`, r.trust_layer));

  let matchedHigh = 0;
  let matchedMedium = 0;
  let rejectedLow = 0;
  let unmatched = 0;
  let evidenceRowsWritten = 0;
  const perField = {};
  const perBusinessReport = [];

  for (const nex of workload) {
    const query = `${nex.business_name} ${nex.district ?? "Yogyakarta"} Indonesia`;
    if (dryRun) {
      const alreadyHas = [
        nex.whatsapp_number ? "WA" : null,
        nex.phone ? "phone" : null,
        nex.website ? "web" : null,
      ].filter(Boolean).join("+") || "no-contact";
      console.log(`  → ${nex.public_listing_ref}  [${nex.category ?? "?"}]  ${nex.business_name.slice(0, 45).padEnd(45)}  currently: ${alreadyHas}`);
      console.log(`      would query Google: "${query}"`);
    }
    let searchResp;
    try {
      searchResp = await textSearch(query);
    } catch (err) {
      console.log(`  ✗ ${nex.public_listing_ref}  search failed: ${err.message}`);
      continue;
    }

    const candidates = searchResp.places ?? [];
    if (candidates.length === 0) { unmatched++; continue; }

    // Score each candidate · pick best by composite confidence
    let best = null, bestMatch = null;
    for (const c of candidates) {
      const m = identityMatch(nex, c);
      if (!bestMatch || m.confidence > bestMatch.confidence) { best = c; bestMatch = m; }
    }
    if (!best) { unmatched++; continue; }

    const tier = bestMatch.tier;

    // LOW tier · reject match entirely · no evidence written
    if (tier === "LOW") {
      rejectedLow++;
      perBusinessReport.push({
        ref: nex.public_listing_ref,
        name: nex.business_name,
        matchName: best.displayName?.text ?? null,
        tier: "LOW",
        confidence: bestMatch.confidence,
        reasoning: bestMatch.reasoning,
        distMetres: bestMatch.distMetres,
        fields: {},
        action: "REJECT (below threshold)",
      });
      continue;
    }

    // Fetch details for HIGH and MEDIUM
    let details;
    try { details = await placeDetails(best.id); }
    catch (err) {
      console.log(`  ✗ ${nex.public_listing_ref}  details failed: ${err.message}`);
      continue;
    }

    // Build the evidence list (evidence ALWAYS written for HIGH + MEDIUM ·
    // promotion to typed columns only for HIGH)
    // WhatsApp discipline (Philip 2026-08-21):
    //   Google phone → 'phone' (typed column eligible)
    //   Also → 'whatsapp_candidate' (lower confidence · never touches whatsapp_number)
    const evRows = [];
    if (details.internationalPhoneNumber) {
      const clean = details.internationalPhoneNumber.replace(/\s+/g, " ").trim();
      evRows.push({ field: "phone", value: clean, conf: 0.90 });
      evRows.push({ field: "whatsapp_candidate", value: clean, conf: 0.60 });
    }
    if (details.websiteUri) evRows.push({ field: "website", value: details.websiteUri, conf: 0.90 });
    if (details.formattedAddress) evRows.push({ field: "address", value: details.formattedAddress, conf: 0.90 });
    if (details.rating != null) evRows.push({ field: "rating", value: String(details.rating), conf: 0.85 });
    if (details.userRatingCount != null) evRows.push({ field: "review_count", value: String(details.userRatingCount), conf: 0.85 });
    if (details.regularOpeningHours?.weekdayDescriptions) {
      evRows.push({ field: "opening_hours",
                    value: details.regularOpeningHours.weekdayDescriptions.join("\n"),
                    conf: 0.90 });
    }
    if (details.primaryTypeDisplayName?.text) {
      evRows.push({ field: "cuisine", value: details.primaryTypeDisplayName.text, conf: 0.75 });
    }

    const fieldSummary = {};
    for (const ev of evRows) {
      const provKey = `${nex.public_listing_ref}|${ev.field}`;
      const layer = provenance.get(provKey);
      if (layer === "owner_verified" || layer === "admin_verified") continue;
      perField[ev.field] = (perField[ev.field] ?? 0) + 1;
      fieldSummary[ev.field] = ev.value;
      if (!dryRun) {
        await pool.query(
          `INSERT INTO nex.food_enrichment_evidence
             (business_ref, field_name, value, value_normalised,
              source, source_type, source_url, confidence, agent_name, provenance_layer, raw_payload)
           VALUES ($1, $2, $3, $4, 'google_places', 'public_directory', $5, $6, 'contact', 'source_import', $7)`,
          [nex.public_listing_ref, ev.field, ev.value, ev.value.toLowerCase(),
           `https://www.google.com/maps/place/?q=place_id:${best.id}`, ev.conf,
           JSON.stringify({ place_id: best.id, tier, name_match_confidence: bestMatch.confidence,
                            name_jaccard: bestMatch.nameJaccard, dist_metres: bestMatch.distMetres,
                            generic_name: bestMatch.generic })]
        );
      }
      evidenceRowsWritten++;
    }

    // Mark MEDIUM matches for HQ review (nex.food_enrichment_job row · not promoted)
    if (tier === "MEDIUM" && !dryRun) {
      await pool.query(
        `INSERT INTO nex.food_enrichment_job
           (business_ref, agent, status, last_error, input_snapshot, output_summary, created_by)
         VALUES ($1, 'verification', 'needs_review', $2, $3, $4, 'agent:google_places')
         ON CONFLICT (business_ref, agent) WHERE status IN ('pending','running') DO NOTHING`,
        [nex.public_listing_ref,
         `MEDIUM confidence Google match · ${bestMatch.reasoning}`,
         JSON.stringify({ nex_name: nex.business_name, coords: [nex.coordinates_lat, nex.coordinates_lng] }),
         JSON.stringify({ google_place_id: best.id, google_name: best.displayName?.text, ...bestMatch, evidence_fields: Object.keys(fieldSummary) })]
      );
    }

    if (tier === "HIGH") matchedHigh++;
    else if (tier === "MEDIUM") matchedMedium++;

    perBusinessReport.push({
      ref: nex.public_listing_ref,
      name: nex.business_name,
      matchName: best.displayName?.text ?? null,
      tier,
      confidence: bestMatch.confidence,
      reasoning: bestMatch.reasoning,
      distMetres: bestMatch.distMetres,
      fields: fieldSummary,
      action: tier === "HIGH" ? "PROMOTE (auto)" : "REVIEW (HQ queue)",
    });
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("── PER-BUSINESS RESULT ──");
  console.log("");
  console.log("Ref             Business                                     Match                                        Conf  Tier    Phone  Web  Hours  Action");
  console.log("───             ────────                                     ─────                                        ────  ────    ─────  ───  ─────  ──────");
  for (const r of perBusinessReport) {
    const shortName = (r.name ?? "").slice(0, 43).padEnd(43);
    const shortMatch = (r.matchName ?? "—").slice(0, 43).padEnd(43);
    const conf = r.confidence.toFixed(2);
    const tier = r.tier.padEnd(6);
    const p = r.fields["phone"] ? "✓" : "·";
    const w = r.fields["website"] ? "✓" : "·";
    const h = r.fields["opening_hours"] ? "✓" : "·";
    console.log(`${r.ref.padEnd(15)} ${shortName} ${shortMatch} ${conf}  ${tier}   ${p}      ${w}     ${h}     ${r.action}`);
    if (r.reasoning) console.log(`                    ${r.reasoning}`);
  }
  console.log("");
  console.log("── AGGREGATE SUMMARY ──");
  console.log(`  duration                    : ${elapsedSec}s`);
  console.log(`  workload processed          : ${workload.length}`);
  console.log(`  HIGH confidence (promoted)  : ${matchedHigh}`);
  console.log(`  MEDIUM confidence (review)  : ${matchedMedium}`);
  console.log(`  LOW confidence (rejected)   : ${rejectedLow}`);
  console.log(`  no candidates from Google   : ${unmatched}`);
  console.log(`  evidence rows written       : ${evidenceRowsWritten}`);
  console.log(`  per-field field-fills:`);
  for (const [f, n] of Object.entries(perField).sort((a,b) => b[1]-a[1])) {
    console.log(`    ${f.padEnd(24)} ${n}`);
  }
  console.log("");
  console.log(`  API calls (Text Search): ${textSearchCalls}   ($${(textSearchCalls * 0.032).toFixed(2)} pre-free-tier)`);
  console.log(`  API calls (Place Details): ${placeDetailsCalls}   ($${(placeDetailsCalls * 0.017).toFixed(2)} pre-free-tier)`);
  console.log(`  cache hits (30-day cached): ${cachedHits}`);
  console.log("");
  console.log("  ── COST · free-tier aware ──");
  console.log("  Text Search Essentials free cap: 10,000 calls/month → charged only above that");
  console.log("  Place Details Pro free cap    : 5,000 calls/month → charged only above that");
  const tsCharge = Math.max(0, textSearchCalls - 10000) * 0.032;
  const pdCharge = Math.max(0, placeDetailsCalls - 5000) * 0.017;
  console.log(`  Text Search chargeable      : $${tsCharge.toFixed(2)}`);
  console.log(`  Place Details chargeable    : $${pdCharge.toFixed(2)}`);
  console.log(`  ── ACTUAL BILLED COST THIS RUN · $${(tsCharge + pdCharge).toFixed(2)} USD ──`);
  console.log("  (Assumes no other Google Maps usage on this billing account this month.)");
  if (dryRun) {
    console.log("");
    console.log("  Because this is DRY RUN · no API calls were made · no cost incurred.");
  }

  await pool.end();
}

main().catch((err) => { console.error(`FATAL: ${err.message}`); console.error(err.stack); process.exit(1); });
