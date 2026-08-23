// NEX Universal Acquisition Engine · vertical config · Food · Yogyakarta.
//
// CONFIG DATA ONLY. No framework code. Adding a second vertical (Hotels ·
// Villas · Drivers · Trades · Shops · Services) means adding a sibling
// config file in this directory — never touching engine.mjs or gates.mjs
// or sources/*.
//
// Doctrine reference:
//   project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//   (Universal-engine anti-pattern: never fork per vertical.)

import { osmOverpassSource } from "../sources/osm-overpass.mjs";
import { businessWebsiteSource } from "../sources/business-website.mjs";

// Task #85 (2026-08-22) · classifyFoodBusiness returns { primary, secondary }.
//
// Doctrine anchors:
//   Q1=B · primary stays single-value (existing 4-enum CHECK on food_business.category)
//         · richer classification lands in food_business.categories text[] (migration 075)
//   Q2=C · never widens the existing CHECK · protects /food directory + filter behavior
//   Q3=AGGRESSIVE · handles amenity=* AND shop=* families AND cuisine tokens AND name heuristics (warung/warteg/angkring)
//   Bakery bug fix · was incorrectly mapping to "ice-cream-dessert" primary via a
//     stale rule · now primary=ice-cream-dessert (unchanged for compatibility) but
//     secondary includes "bakery"+"pastry" so downstream can distinguish.
//
// Task #85 follow-up (2026-08-22 · Philip) · categories[] is a NEX-USER-FACING
// ontology, NOT a raw dump of OSM cuisine tokens. Only whitelisted tokens
// survive into categories[]. Raw OSM values continue to live in
// nex.food_business_source_snapshot.raw_payload (JSONB · full tags preserved)
// so no evidence is lost. This keeps categories[] usable for future filter
// chips without polluting with fragments like "chicken", "regional", "asian",
// "local", "friture", "_fish", "drinks" which are not meaningful NEX categories.
//
// Evidence-based · never invents. Only tags returned by OSM go into secondary.
// Duplicates de-duped via Set. Empty secondary is fine.

// NEX-approved user-facing secondary category ontology (Task #85 follow-up · 2026-08-22).
// All tokens hyphenated form · underscores normalised at classification time.
// Adding a new token = editing this set only · no schema change needed.
const NEX_APPROVED_SECONDARY = new Set([
  // Business form
  "restaurant", "cafe", "coffee", "coffee-shop",
  "fast-food",
  "ice-cream", "bakery", "pastry", "chocolate", "confectionery",
  "warung", "warteg", "street-food",
  "beverages", "tea", "juice", "smoothie", "bubble-tea",
  "food-court", "marketplace",
  "deli", "butcher", "cheese", "seafood", "dairy", "greengrocer", "frozen-food",
  "specialty-food",
  // National/regional cuisines
  "indonesian", "javanese", "sundanese", "padang", "balinese",
  "chinese", "japanese", "korean", "indian", "thai", "vietnamese", "malaysian",
  "italian", "french", "spanish", "mediterranean", "greek",
  "western", "european", "american", "mexican",
  "pizza", "sushi", "ramen", "noodle",
  // Dietary
  "vegetarian", "vegan", "halal",
  // Service model (informational · never a primary)
  "takeaway", "delivery",
]);

// Normalise a raw token to canonical NEX form.
// - lowercase
// - trim whitespace
// - underscores → hyphens
// - drop leading/trailing non-alphanumeric noise (e.g. "_fish" → "fish")
function normaliseToken(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

// Filter a token through the NEX-approved ontology.
// Returns "" (filtered out) or the canonical form.
function adoptSecondary(raw) {
  const t = normaliseToken(raw);
  return NEX_APPROVED_SECONDARY.has(t) ? t : "";
}

function classifyFoodBusiness(amenity, shop, cuisine, tags) {
  const secondary = new Set();

  // ── PRIMARY · maps every recognised food-domain tag to one of the 4 legacy
  //             enum values (restaurant · coffee-cafe · ice-cream-dessert · fast-food).
  //             Never introduces new primary values · CHECK constraint remains intact.
  let primary = null;

  // Amenity-driven primary
  if (amenity === "restaurant")                         primary = "restaurant";
  else if (amenity === "cafe" || amenity === "coffee_shop") primary = "coffee-cafe";
  else if (amenity === "fast_food")                     primary = "fast-food";
  else if (amenity === "ice_cream")                     primary = "ice-cream-dessert";
  else if (amenity === "bakery")                        primary = "ice-cream-dessert";
  else if (amenity === "food_court")                    primary = "restaurant";
  else if (amenity === "marketplace")                   primary = "restaurant";
  // Shop-driven primary (Task #85 · shop=* family)
  else if (shop === "bakery" || shop === "pastry")      primary = "ice-cream-dessert";
  else if (shop === "confectionery" || shop === "chocolate" || shop === "ice_cream") primary = "ice-cream-dessert";
  else if (shop === "coffee" || shop === "tea")         primary = "coffee-cafe";
  else if (shop === "beverages")                        primary = "coffee-cafe";
  else if (shop === "deli" || shop === "butcher" || shop === "cheese" || shop === "seafood" || shop === "dairy" || shop === "greengrocer" || shop === "frozen_food") primary = "restaurant";
  else                                                   primary = "restaurant";

  // ── SECONDARY · every additional evidence signal that survives dedup ──
  // Task #85 follow-up (2026-08-22) · every candidate token passes through
  // adoptSecondary() which normalises + whitelists. Anything not in the
  // NEX-approved ontology is dropped here. Raw evidence is preserved in
  // nex.food_business_source_snapshot.raw_payload (never lost).
  const addIfApproved = (raw) => {
    const t = adoptSecondary(raw);
    if (t) secondary.add(t);
  };

  // Raw amenity + shop tokens
  if (amenity) addIfApproved(amenity);
  if (shop)    addIfApproved(shop);

  // Cuisine tokens (semicolon/comma-separated per OSM convention)
  const cLc = String(cuisine ?? "").toLowerCase();
  if (cLc) {
    for (const token of cLc.split(/[;,]/).map((t) => t.trim()).filter(Boolean)) {
      addIfApproved(token);
    }
  }

  // Indonesian-specific heuristics from name (warung / warteg / angkring).
  // These bypass adoptSecondary because we know they're in the whitelist.
  const nameLc = String(tags?.name ?? tags?.["name:id"] ?? "").toLowerCase();
  if (/\bwarung\b/.test(nameLc))   secondary.add("warung");
  if (/\bwarteg\b/.test(nameLc))   secondary.add("warteg");
  if (/\bangkring/.test(nameLc))   secondary.add("street-food");

  // Service signals (takeaway · delivery)
  if (tags?.takeaway === "yes")    secondary.add("takeaway");
  if (tags?.delivery === "yes")    secondary.add("delivery");

  // Return · secondary de-duplicated · never includes primary duplicate
  return {
    primary,
    secondary: [...secondary].filter((s) => s !== primary && s.length > 0),
  };
}

// Legacy single-value signature preserved for callers still relying on it.
// Delegates to the new classifier and returns primary only.
function foodCategoryMapping(amenity, cuisine, tags) {
  const { primary } = classifyFoodBusiness(amenity, tags?.shop ?? null, cuisine, tags);
  return primary;
}

// Kota Yogyakarta full bbox (same as existing OSM importer).
const YOGYA_FULL_BBOX = { sw: [-7.85, 110.35], ne: [-7.75, 110.42] };

// Prawirotaman neighborhood smoke-test bbox (~600m × 600m).
// Small tourist-food area · good sample density · quick to iterate.
// Fully covered by earlier full-city OSM ingest → dedupe validation, not
// gate exercise.
const PRAWIROTAMAN_BBOX = { sw: [-7.821, 110.360], ne: [-7.815, 110.368] };

// Kaliurang fringe bbox (~2km × 2km · ~15km north of Yogyakarta city).
// Mountain-resort area with cafes/restaurants. OUTSIDE earlier full-city
// ingest bbox → yields actual NEW candidates that exercise Gates 3-4.
// Needs live Overpass (fallback cache is city-only).
const KALIURANG_BBOX = { sw: [-7.605, 110.415], ne: [-7.585, 110.435] };

// Prambanan corridor fringe bbox (~5km × 5km · east of Yogyakarta).
// Historic tourist area near Prambanan temple · higher expected
// contactability than Kaliurang (tourist businesses more likely to
// publish contact tags). OUTSIDE earlier full-city ingest bbox
// (east of 110.42) → yields genuinely new candidates.
const PRAMBANAN_BBOX = { sw: [-7.780, 110.450], ne: [-7.740, 110.500] };

// Task #84 · 2026-08-22 · Four uncovered expansion zones for Walker rotation.
// Each is outside the earlier full-city ingest (which produced 806 rows in the
// kota-yogya area) AND outside the currently populated fringes (Prambanan 110 rows,
// Kaliurang 5 rows). Sized ~5-10km × 5-10km each · comparable to Prambanan bbox ·
// safe under Overpass 60s timeout · genuine new-business potential.
// Geographic coverage matrix (Yogyakarta DIY special region):
//   north of city  → SLEMAN_NORTH_BBOX  (Kaliurang road corridor · Cangkringan)
//   south of city  → BANTUL_SOUTH_BBOX  (Bantul town · Sewon · Pandak)
//   east of city   → KLATEN_EAST_BBOX   (Klaten corridor beyond Prambanan)
//   west of city   → GAMPING_WEST_BBOX  (Gamping · Godean fringe)
// Together with PRAMBANAN_BBOX these 5 zones give Walker systematic coverage
// of the wider Yogyakarta area rather than repeatedly hammering one bbox.
const SLEMAN_NORTH_BBOX = { sw: [-7.720, 110.350], ne: [-7.640, 110.450] };
const BANTUL_SOUTH_BBOX = { sw: [-7.950, 110.300], ne: [-7.860, 110.400] };
const KLATEN_EAST_BBOX  = { sw: [-7.780, 110.550], ne: [-7.700, 110.650] };
const GAMPING_WEST_BBOX = { sw: [-7.820, 110.240], ne: [-7.740, 110.340] };

export const foodYogyakartaConfig = {
  vertical: "food",
  city: "Yogyakarta",
  country: "ID",                     // Country Foundation Step 4 (2026-08-22) · every INSERT explicitly declares country · NEVER inferred from city
  publicRefPrefix: "#FL",
  defaultBbox: YOGYA_FULL_BBOX,
  smokeBbox: PRAWIROTAMAN_BBOX,
  smokeBboxes: {
    prawirotaman: PRAWIROTAMAN_BBOX,
    kaliurang: KALIURANG_BBOX,
    prambanan: PRAMBANAN_BBOX,
    // Task #84 · expansion zones · geographic rotation targets
    "sleman-north": SLEMAN_NORTH_BBOX,
    "bantul-south": BANTUL_SOUTH_BBOX,
    "klaten-east":  KLATEN_EAST_BBOX,
    "gamping-west": GAMPING_WEST_BBOX,
  },
  tables: {
    business: "nex.food_business",
    evidence: "nex.food_enrichment_evidence",
    snapshot: "nex.food_business_source_snapshot",
    provenance: "nex.food_business_field_provenance",
  },
  osmOverpass: {
    // Task #85 (2026-08-22) · Q3=AGGRESSIVE · widened from 6 amenities to
    // amenities + shopTypes covering the sensible food/beverage universe.
    // Deliberately excludes pub/bar/nightclub (Philip 2026-08-22 · would pollute
    // food directory with nightlife venues that only sometimes serve food).
    amenities: [
      // Original 6 (kept)
      "restaurant", "cafe", "fast_food", "ice_cream", "bakery", "coffee_shop",
      // Task #85 additions · unambiguously food
      "food_court", "marketplace",
    ],
    shopTypes: [
      // Task #85 · shop=* family · unambiguously food/beverage
      "bakery", "confectionery", "pastry", "chocolate", "ice_cream",
      "coffee", "tea", "beverages",
      "butcher", "deli", "cheese", "seafood", "dairy", "greengrocer", "frozen_food",
    ],
    categoryMapping: foodCategoryMapping,        // legacy single-value · still used by older callers
    classifier:      classifyFoodBusiness,        // Task #85 · returns { primary, secondary[] }
  },
  sources: [
    osmOverpassSource(),
    businessWebsiteSource(),
  ],
  killSwitchEngaged: false,

  async insertNewRecord(pool, candidate, { jobId, sourceName }) {
    // Freshness doctrine (Philip 2026-08-21): capture source_updated_at +
    // last_verified_at at insert time. Freshness is derived from evidence,
    // NEVER from discovery date. If OSM didn't expose a timestamp, these
    // stay NULL and the record is UNVERIFIED until re-verify runs.
    // Task #85 (2026-08-22) · write secondary categories[] alongside primary category.
    // categories[] defaults to empty array in migration 075 · Walker fills it
    // when the classifier returns evidence-based secondary tokens.
    const secondaryCategories = Array.isArray(candidate.categories) ? candidate.categories : [];
    const ins = await pool.query(
      // Country Foundation Step 4 (2026-08-22) · country ($20) sourced from this.country (config).
      // NEVER derived from city. Any attempt to add city→country inference here violates the
      // Truth Invariant + Country three-layer doctrine.
      `INSERT INTO ${this.tables.business} (
         public_listing_ref, business_name, category, categories, address, city,
         coordinates_lng, coordinates_lat,
         whatsapp_number, phone, website,
         source, source_reference, source_ingested_at, source_licence_terms,
         source_updated_at, last_verified_at, verification_source,
         dedupe_hash, claim_status, owner_status, created_by, country
       ) VALUES (
         $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11,
         $12, $13, now(), $14,
         $15, $16, $17,
         $18, 'discovered', 'unknown', $19, $20
       )
       ON CONFLICT DO NOTHING
       RETURNING public_listing_ref`,
      [
        candidate.publicRef, candidate.name, candidate.category, secondaryCategories, candidate.address, this.city,
        candidate.lng, candidate.lat,
        candidate.whatsapp, candidate.phone, candidate.website,
        candidate.sourceType, candidate.sourceReference, candidate.sourceLicenceTerms,
        candidate.sourceUpdatedAt ?? null,
        candidate.lastVerifiedAt ?? null,
        candidate.verificationSource ?? null,
        candidate.dedupeHash, `agent:universal-acquisition:${sourceName}:${jobId}`,
        this.country,   // Country Foundation Step 4 · $20 · from config, never inferred
      ]
    );
    if (ins.rowCount === 0) return false;

    // Task #53 · Per-field OSM provenance on initial insert.
    // Trust hierarchy (nex_food_field_trust enum · verified 2026-08-22):
    // source_import < nex_curated < admin_verified < owner_verified.
    // For OSM-sourced fields, trust_layer is 'source_import' (lowest tier).
    // The source-of-origin is separately captured in source_reference.
    // Write a per-field provenance row for every field populated from OSM data.
    // ON CONFLICT DO NOTHING preserves any pre-existing higher-trust provenance
    // (owner_verified would trump this; owner_verified rows come from Layer 3 claim).
    //
    // This closes Philip's stated condition for turning acquisition scheduler
    // on 24/7 (per project_nex_food_flywheel_over_scraping + Walker doctrine).
    const provenanceFields = [];
    provenanceFields.push(["business_name", true]);
    provenanceFields.push(["category", true]);
    if (candidate.address) provenanceFields.push(["address", true]);
    if (candidate.lat != null) provenanceFields.push(["coordinates_lat", true]);
    if (candidate.lng != null) provenanceFields.push(["coordinates_lng", true]);
    if (candidate.phone) provenanceFields.push(["phone", true]);
    if (candidate.whatsapp) provenanceFields.push(["whatsapp_number", true]);
    if (candidate.website) provenanceFields.push(["website", true]);

    const writtenBy = `agent:universal-acquisition:${sourceName}`;
    const sourceRef = candidate.sourceReference ?? null;
    // Task #74 · Direct-Provenance A (2026-08-22): stamp the active
    // worker_cycle_run.id onto every provenance row so the six-criteria
    // evaluator can JOIN by cycle_run_id for output/state evidence.
    // jobId is the cycle_run_id emitted by scripts/nex-worker/reliability.mjs
    // → scripts/nex-acquisition/run-live-cycle.mjs::startCycleRun. Nullable
    // for callers that don't have a cycle (smoke tests, backfill scripts).
    for (const [fieldName] of provenanceFields) {
      await pool.query(
        `INSERT INTO ${this.tables.provenance}
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference, cycle_run_id)
         VALUES ($1, $2, 'source_import', now(), $3, $4, $5)
         ON CONFLICT (business_ref, field_name) DO NOTHING`,
        [candidate.publicRef, fieldName, writtenBy, sourceRef, jobId ?? null]
      );
    }
    return true;
  },
};
